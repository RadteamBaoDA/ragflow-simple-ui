"""
PDF Post-Processor — trims empty/blank pages and whitespace from converted PDFs.

Ported from client/src/core/pdf_processor.py (Windows).
Uses pypdf for PDF manipulation and pdfminer.six for content detection.

Features:
- Detect and remove completely empty/blank pages
- Auto-detect content bounds and trim whitespace (CropBox)
- Configurable margin padding
- Parallel content detection for multi-page PDFs
"""
import os
import gc
from pathlib import Path
from typing import Optional, Tuple, List
from concurrent.futures import ThreadPoolExecutor, as_completed

from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
from pdfminer.high_level import extract_pages
from pdfminer.layout import (
    LTPage, LTTextContainer, LTImage, LTFigure,
    LTRect, LTLine, LTCurve, LTTextBox
)

from src.logger import logger

# Default thread pool for parallel processing
_DEFAULT_WORKERS = min(8, (os.cpu_count() or 4))


# ============================================================================
# SimpleRect helper
# ============================================================================

class SimpleRect:
    """Bounding box helper for content detection."""

    def __init__(self, x0: float, y0: float, x1: float, y1: float,
                 is_important: bool = False):
        self.x0 = x0
        self.y0 = y0
        self.x1 = x1
        self.y1 = y1
        self.is_important = is_important

    @property
    def width(self) -> float:
        return self.x1 - self.x0

    @property
    def height(self) -> float:
        return self.y1 - self.y0

    @property
    def area(self) -> float:
        return self.width * self.height


# ============================================================================
# Public API
# ============================================================================

def trim_empty_pages(pdf_path: str, output_path: Optional[str] = None) -> str:
    """
    Remove completely empty/blank pages from a PDF.

    A page is considered "empty" if pdfminer detects no text, images,
    or vector graphics on it.

    @param pdf_path: Path to the input PDF.
    @param output_path: Optional output path. Defaults to overwriting input.
    @returns: Path to the processed PDF.
    """
    input_file = Path(pdf_path)
    target = Path(output_path) if output_path else input_file

    reader = PdfReader(str(input_file))
    total_pages = len(reader.pages)

    if total_pages == 0:
        logger.warning(f'PDF has no pages: {input_file.name}')
        return str(target)

    # Detect which pages have content
    pages_with_content: List[bool] = []
    try:
        layout_iter = iter(extract_pages(str(input_file)))
        for i in range(total_pages):
            try:
                lt_page = next(layout_iter)
                has_content = _page_has_content(lt_page)
            except StopIteration:
                has_content = True  # If pdfminer fails, keep the page
            pages_with_content.append(has_content)
    except Exception as e:
        logger.warning(f'pdfminer analysis failed, keeping all pages: {e}')
        return str(target)

    # Count empty pages
    empty_count = pages_with_content.count(False)
    if empty_count == 0:
        logger.info(f'No empty pages found in: {input_file.name}')
        return str(target)

    # Don't remove ALL pages
    if empty_count == total_pages:
        logger.warning(f'All {total_pages} pages appear empty, keeping original')
        return str(target)

    logger.info(
        f'Removing {empty_count} empty page(s) from {total_pages} total '
        f'in: {input_file.name}'
    )

    # Build new PDF with only non-empty pages
    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if pages_with_content[i]:
            writer.add_page(page)

    # Save
    _save_pdf(writer, input_file, target)
    logger.info(f'Trimmed: {total_pages} → {total_pages - empty_count} pages')

    return str(target)


def trim_whitespace(
    pdf_path: str,
    margin: float = 10.0,
    output_path: Optional[str] = None,
    max_workers: int = _DEFAULT_WORKERS,
) -> str:
    """
    Auto-detect content bounds and crop PDF to remove whitespace.

    Ported from client/src/core/pdf_processor.py.

    Algorithm:
    1. Analyze content bounds using pdfminer (parallel for large PDFs)
    2. Calculate union rectangle of all content (filtering outliers)
    3. Apply CropBox via pypdf (non-destructive)

    @param pdf_path: Path to the input PDF.
    @param margin: Padding in points around detected content (default 10pt).
    @param output_path: Optional output path. Defaults to overwriting input.
    @param max_workers: Thread pool size for parallel processing.
    @returns: Path to the processed PDF.
    """
    input_file = Path(pdf_path)
    target = Path(output_path) if output_path else input_file

    logger.info(f'Trimming whitespace: {input_file.name}')

    reader = PdfReader(str(input_file))
    num_pages = len(reader.pages)

    # Extract layout pages and dimensions
    layout_pages: List[Optional[LTPage]] = []
    page_dimensions: List[Tuple[float, float]] = []

    try:
        layout_iter = iter(extract_pages(str(input_file)))
        for i, page in enumerate(reader.pages):
            lt_page = None
            try:
                lt_page = next(layout_iter)
            except StopIteration:
                pass
            layout_pages.append(lt_page)
            mb = page.mediabox
            page_dimensions.append((float(mb.width), float(mb.height)))
        del layout_iter
    except Exception as e:
        logger.warning(f'pdfminer extraction failed: {e}')
        return str(target)

    # Detect content bounds (parallel for large PDFs)
    content_rects = _detect_bounds_parallel(
        layout_pages, page_dimensions, max_workers
    )
    del layout_pages
    gc.collect()

    # Apply crops
    writer = PdfWriter()
    modified = False

    for i, page in enumerate(reader.pages):
        content_rect = content_rects[i]
        mb = page.mediabox

        if content_rect:
            c_x0, c_y0, c_x1, c_y1 = content_rect

            # Add margin padding
            new_x0 = max(float(mb.left), c_x0 - margin)
            new_y0 = max(float(mb.bottom), c_y0 - margin)
            new_x1 = min(float(mb.right), c_x1 + margin)
            new_y1 = min(float(mb.top), c_y1 + margin)

            # Only crop if it saves at least 5% of page area
            current_w = float(mb.width)
            current_h = float(mb.height)
            new_w = new_x1 - new_x0
            new_h = new_y1 - new_y0

            if new_w < current_w * 0.95 or new_h < current_h * 0.95:
                page.cropbox = RectangleObject(
                    (new_x0, new_y0, new_x1, new_y1)
                )
                modified = True
                logger.debug(
                    f'Page {i + 1}: cropped {current_w:.0f}x{current_h:.0f} '
                    f'→ {new_w:.0f}x{new_h:.0f}'
                )

        writer.add_page(page)

    if modified:
        _save_pdf(writer, input_file, target)
        logger.info(f'Whitespace trimmed: {input_file.name}')
    else:
        logger.info(f'No trimming needed: {input_file.name}')

    gc.collect()
    return str(target)


def process_pdf(
    pdf_path: str,
    remove_empty: bool = True,
    trim: bool = True,
    trim_margin: float = 10.0,
    output_path: Optional[str] = None,
) -> str:
    """
    Full PDF post-processing pipeline.

    1. Remove empty pages (if enabled)
    2. Trim whitespace (if enabled)

    @param pdf_path: Path to the PDF file.
    @param remove_empty: Whether to remove empty pages.
    @param trim: Whether to trim whitespace.
    @param trim_margin: Margin for whitespace trimming (points).
    @param output_path: Optional output path.
    @returns: Path to the processed PDF.
    """
    result_path = pdf_path

    if remove_empty:
        result_path = trim_empty_pages(result_path, output_path)

    if trim:
        result_path = trim_whitespace(result_path, margin=trim_margin,
                                       output_path=output_path)

    return result_path


# ============================================================================
# Internal helpers
# ============================================================================

def _page_has_content(lt_page: LTPage) -> bool:
    """
    Check if a pdfminer LTPage has any meaningful content.

    @param lt_page: pdfminer layout page.
    @returns: True if page has text, images, or significant graphics.
    """
    for element in lt_page:
        if isinstance(element, (LTTextContainer, LTTextBox)):
            if element.get_text().strip():
                return True
        elif isinstance(element, (LTImage, LTFigure)):
            return True
        elif isinstance(element, (LTRect, LTLine, LTCurve)):
            # Filter tiny decorative elements (borders, lines < 5pt)
            bbox = element.bbox
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            if w > 5 and h > 5:
                return True
    return False


def _detect_bounds_parallel(
    layout_pages: List[Optional[LTPage]],
    page_dimensions: List[Tuple[float, float]],
    max_workers: int,
) -> List[Optional[Tuple[float, float, float, float]]]:
    """
    Detect content bounds for multiple pages, using parallel threads for large PDFs.
    """
    num_pages = len(layout_pages)
    results: List[Optional[Tuple[float, float, float, float]]] = [None] * num_pages

    # Sequential for small PDFs
    if num_pages <= 2:
        for i, (lt_page, dims) in enumerate(zip(layout_pages, page_dimensions)):
            if lt_page:
                results[i] = _detect_content_bounds(lt_page, dims[0], dims[1])
        return results

    # Parallel
    def _process(args):
        idx, lt_page, (w, h) = args
        if lt_page is None:
            return (idx, None)
        return (idx, _detect_content_bounds(lt_page, w, h))

    work = [(i, layout_pages[i], page_dimensions[i]) for i in range(num_pages)]

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_process, item): item[0] for item in work}
        for future in as_completed(futures):
            try:
                idx, rect = future.result()
                results[idx] = rect
            except Exception as e:
                logger.warning(f'Bounds detection failed for page {futures[future] + 1}: {e}')

    return results


def _detect_content_bounds(
    lt_page: LTPage,
    page_width: float,
    page_height: float,
) -> Optional[Tuple[float, float, float, float]]:
    """
    Detect content bounds using pdfminer layout analysis.

    Ported from client/src/core/pdf_processor.py._detect_content_bounds.
    Uses outlier rejection: large background rectangles skipped,
    tiny expansive elements rejected unless they are text (headers/footers).

    @returns: (x0, y0, x1, y1) or None.
    """
    rects: List[SimpleRect] = []
    page_area = page_width * page_height

    stack = list(lt_page)
    while stack:
        element = stack.pop()
        is_content = False

        if isinstance(element, (LTTextContainer, LTTextBox)):
            if element.get_text().strip():
                is_content = True
        elif isinstance(element, (LTImage, LTFigure)):
            is_content = True
        elif isinstance(element, (LTRect, LTLine, LTCurve)):
            is_content = True

        if is_content:
            bbox = element.bbox
            x0, y0, x1, y1 = bbox
            w = x1 - x0
            h = y1 - y0

            # Skip background artifacts (>90% of page)
            if w * h > page_area * 0.90:
                continue

            is_text = isinstance(element, (LTTextContainer, LTTextBox))
            rects.append(SimpleRect(x0, y0, x1, y1, is_important=is_text))

        # Recurse into containers
        if isinstance(element, (LTFigure, LTTextContainer)) and hasattr(element, '__iter__'):
            pass  # Content already extracted from container

    if not rects:
        return None

    # Outlier rejection via area-based merge
    rects.sort(key=lambda r: r.area, reverse=True)
    union = rects[0]

    for rect in rects[1:]:
        current_area = union.width * union.height

        ux0 = min(union.x0, rect.x0)
        uy0 = min(union.y0, rect.y0)
        ux1 = max(union.x1, rect.x1)
        uy1 = max(union.y1, rect.y1)

        merged_area = (ux1 - ux0) * (uy1 - uy0)
        expansion = merged_area - current_area

        is_tiny = rect.area < current_area * 0.01
        is_expansive = expansion > current_area * 0.10

        # Keep text elements even if they expand bounds (headers/footers)
        if is_tiny and is_expansive and not rect.is_important:
            continue

        union = SimpleRect(ux0, uy0, ux1, uy1)

    return (union.x0, union.y0, union.x1, union.y1)


def _save_pdf(writer: PdfWriter, input_file: Path, target: Path) -> None:
    """Save a PdfWriter to disk, handling overwrites safely."""
    target.parent.mkdir(parents=True, exist_ok=True)

    if target == input_file:
        # Overwrite: write to temp then rename
        temp = input_file.with_suffix('.tmp.pdf')
        with open(temp, 'wb') as f:
            writer.write(f)
        temp.replace(input_file)
    else:
        with open(target, 'wb') as f:
            writer.write(f)
