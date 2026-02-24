"""
PDF Post-Processing utilities using pypdf and pdfminer.six.

Features:
- Auto-detect content bounds and trim whitespace
- Non-destructive cropping via CropBox manipulation
- License-friendly (BSD/MIT) implementation suitable for enterprise use
- Parallel processing for improved performance
"""

from pathlib import Path
from typing import Optional, Tuple, List
from concurrent.futures import ThreadPoolExecutor, as_completed
import gc
import os

from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
from pdfminer.high_level import extract_pages
from pdfminer.layout import (
    LTPage, LTTextContainer, LTImage, LTFigure, 
    LTRect, LTLine, LTCurve, LTTextBox
)

from ..utils.logger import logger

# Default thread pool size for parallel processing
_DEFAULT_WORKERS = min(8, (os.cpu_count() or 4))


class PDFProcessor:
    """Post-processing utilities for PDF files using pypdf and pdfminer."""
    
    def __init__(self, max_workers: Optional[int] = None):
        """
        Initialize PDFProcessor.
        
        Args:
            max_workers: Maximum number of threads for parallel processing.
                        Defaults to min(8, cpu_count).
        """
        self.max_workers = max_workers or _DEFAULT_WORKERS
    
    def trim_whitespace(
        self, 
        pdf_path: Path, 
        margin: float = 10.0,
        output_path: Optional[Path] = None
    ) -> Path:
        """
        Auto-detect content bounds and crop PDF to remove whitespace.
        
        Algorithm:
        1. Analyze content bounds using pdfminer (parallel processing)
        2. Calculate union rectangle of all content (filtering outliers)
        3. Apply crop using pypdf
        
        Args:
            pdf_path: Input PDF file path
            margin: Padding in points around detected content (default: 10pt)
            output_path: Optional output path (defaults to overwrite input)
            
        Returns:
            Path to the processed PDF file
        """
        pdf_path = Path(pdf_path).resolve()
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        # Default: overwrite input file
        target_path = output_path.resolve() if output_path else pdf_path
        
        logger.info(f"Starting whitespace trimming for '{pdf_path.name}'...")
        logger.debug(f"Analyzing content bounds (using pypdf/pdfminer)...")
        
        modified = False
        writer = PdfWriter()
        
        try:
            # 1. Open PDF with pypdf for modification
            reader = PdfReader(str(pdf_path))
            num_pages = len(reader.pages)
            
            # 2. Extract layout pages and page dimensions for parallel processing
            layout_pages: List[Optional[LTPage]] = []
            page_dimensions: List[Tuple[float, float]] = []
            
            layout_iter = iter(extract_pages(str(pdf_path)))
            for i, page in enumerate(reader.pages):
                # Collect layout page
                lt_page = None
                try:
                    lt_page = next(layout_iter)
                except StopIteration:
                    logger.warning(f"pdfminer page exhausted at page {i+1}")
                layout_pages.append(lt_page)
                
                # Collect page dimensions
                mb = page.mediabox
                page_dimensions.append((_to_float(mb.width), _to_float(mb.height)))
            
            del layout_iter
            
            # 3. Parallel content bounds detection
            content_rects = self._detect_bounds_parallel(layout_pages, page_dimensions)
            
            # Free layout pages memory after bounds detection
            del layout_pages
            gc.collect()
            
            # 4. Apply crops sequentially (must maintain page order)
            for i, page in enumerate(reader.pages):
                content_rect = content_rects[i]
                mb = page.mediabox
                
                if content_rect:
                    c_x0, c_y0, c_x1, c_y1 = content_rect
                    
                    # Add margin padding
                    new_x0 = max(_to_float(mb.left), c_x0 - margin)
                    new_y0 = max(_to_float(mb.bottom), c_y0 - margin)
                    new_x1 = min(_to_float(mb.right), c_x1 + margin)
                    new_y1 = min(_to_float(mb.top), c_y1 + margin)
                    
                    # Sanity check: If resulting box is basically the whole page, skip
                    current_w = _to_float(mb.width)
                    current_h = _to_float(mb.height)
                    new_w = new_x1 - new_x0
                    new_h = new_y1 - new_y0
                    
                    if new_w < current_w * 0.95 or new_h < current_h * 0.95:
                        # Apply CropBox
                        page.cropbox = RectangleObject((new_x0, new_y0, new_x1, new_y1))
                        modified = True
                        logger.debug(
                            f"Page {i + 1}: Cropped to {new_w:.1f}x{new_h:.1f}pt "
                            f"(was {current_w:.1f}x{current_h:.1f}pt)"
                        )
                    else:
                        logger.debug(f"Page {i + 1}: Content fills most of page, no trim needed")
                else:
                    logger.debug(f"Page {i + 1}: No significant content detected, skipping")

                writer.add_page(page)
            
            # Save result
            if modified:
                logger.info(f"Saving trimmed PDF to disk...")
                if target_path == pdf_path:
                    # Overwrite
                    temp_path = pdf_path.with_suffix(".tmp.pdf")
                    with open(temp_path, "wb") as f:
                        writer.write(f)
                    
                    temp_path.replace(pdf_path)
                    logger.success(f"Trimmed whitespace from '{pdf_path.name}'")
                else:
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(target_path, "wb") as f:
                        writer.write(f)
                    logger.success(f"Trimmed PDF saved to '{target_path.name}'")
            else:
                logger.info(f"No whitespace trimming needed for '{pdf_path.name}'")
                if target_path != pdf_path:
                    pass

        except Exception as e:
            logger.error(f"Failed to trim whitespace: {e}")
            raise
        finally:
            # Final cleanup
            gc.collect()

        return target_path

    def _detect_bounds_parallel(
        self, 
        layout_pages: List[Optional[LTPage]], 
        page_dimensions: List[Tuple[float, float]]
    ) -> List[Optional[Tuple[float, float, float, float]]]:
        """
        Detect content bounds for multiple pages in parallel.
        
        Args:
            layout_pages: List of pdfminer LTPage objects
            page_dimensions: List of (width, height) tuples
            
        Returns:
            List of content rectangles (x0, y0, x1, y1) or None for each page
        """
        num_pages = len(layout_pages)
        results: List[Optional[Tuple[float, float, float, float]]] = [None] * num_pages
        
        # For small PDFs, process sequentially (thread overhead not worth it)
        if num_pages <= 2:
            for i, (lt_page, dims) in enumerate(zip(layout_pages, page_dimensions)):
                if lt_page:
                    results[i] = self._detect_content_bounds(lt_page, dims[0], dims[1])
            return results
        
        # Parallel processing for larger PDFs
        def process_page(args: Tuple[int, Optional[LTPage], Tuple[float, float]]) -> Tuple[int, Optional[tuple]]:
            idx, lt_page, (width, height) = args
            if lt_page is None:
                return (idx, None)
            return (idx, self._detect_content_bounds(lt_page, width, height))
        
        # Prepare work items
        work_items = [
            (i, layout_pages[i], page_dimensions[i]) 
            for i in range(num_pages)
        ]
        
        # Process in parallel
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(process_page, item): item[0] for item in work_items}
            
            for future in as_completed(futures):
                try:
                    idx, rect = future.result()
                    results[idx] = rect
                except Exception as e:
                    page_idx = futures[future]
                    logger.warning(f"Failed to detect bounds for page {page_idx + 1}: {e}")
        
        return results

    def _detect_content_bounds(self, lt_page: LTPage, page_width: float, page_height: float) -> Optional[tuple]:
        """
        Detect content bounds using pdfminer Layout Analysis.
        Returns (x0, y0, x1, y1) or None.
        """
        rects = []
        page_area = page_width * page_height
        
        # Traverse layout elements
        # LTPage acts as a container
        stack = list(lt_page)
        
        while stack:
            element = stack.pop()
            
            # Determine if element is "content"
            is_content = False
            
            if isinstance(element, (LTTextContainer, LTTextBox)):
                # Text
                if element.get_text().strip():
                    is_content = True
            elif isinstance(element, (LTImage, LTFigure)):
                is_content = True
            elif isinstance(element, (LTRect, LTLine, LTCurve)):
                # Vector graphics
                is_content = True
            
            if is_content:
                # Capture bounding box: (x0, y0, x1, y1)
                bbox = element.bbox
                x0, y0, x1, y1 = bbox
                w = x1 - x0
                h = y1 - y0
                
                # Filter 1: Background Artifacts (Huge rectangles)
                if w * h > page_area * 0.90:
                    continue
                
                # Save rect for clustering
                # Mark text elements to prevent them from being treated as outliers
                is_text = isinstance(element, (LTTextContainer, LTTextBox))
                rects.append(SimpleRect(x0, y0, x1, y1, is_important=is_text))
            
            # Recurse if container (e.g. LTFigure can contain text)
            if isinstance(element, (LTFigure, LTTextContainer)) and hasattr(element, "__iter__"):
                 # Simplification: we usually get text from containers directly
                 pass

        if not rects:
            return None
            
        # Refined Logic: Outlier Rejection
        # 1. Sort by Area Descending
        rects.sort(key=lambda r: r.area, reverse=True)
        
        # 2. Main content
        union_rect = rects[0]
        
        # 3. Merge loop
        for rect in rects[1:]:
            current_union_area = union_rect.width * union_rect.height
            
            # Calculate merged bbox
            ux0 = min(union_rect.x0, rect.x0)
            uy0 = min(union_rect.y0, rect.y0)
            ux1 = max(union_rect.x1, rect.x1)
            uy1 = max(union_rect.y1, rect.y1)
            
            merged_area = (ux1 - ux0) * (uy1 - uy0)
            expansion = merged_area - current_union_area
            
            # Heuristic
            is_tiny = rect.area < current_union_area * 0.01
            is_expansive = expansion > current_union_area * 0.10
            
            # EXCEPTION: If it is text (Important), do not discard even if expensive
            # This preserves Headers/Footers
            if is_tiny and is_expansive and not rect.is_important:
                continue
                
            union_rect = SimpleRect(ux0, uy0, ux1, uy1)
            
        return (union_rect.x0, union_rect.y0, union_rect.x1, union_rect.y1)

class SimpleRect:
    """Helper for bounding box calculations."""
    def __init__(self, x0, y0, x1, y1, is_important: bool = False):
        self.x0 = x0
        self.y0 = y0
        self.x1 = x1
        self.y1 = y1
        self.is_important = is_important
    
    @property
    def width(self): return self.x1 - self.x0
    
    @property
    def height(self): return self.y1 - self.y0
    
    @property
    def area(self): return self.width * self.height


def _to_float(val):
    """Safely convert pypdf float objects to python float"""
    return float(val)
