"""
Excel Converter — converts .xls, .xlsx, .xlsm to PDF using LibreOffice.

Ports the logic from client/src/core/excel_converter.py (Windows COM, 1941 lines)
to LibreOffice on Linux. Uses Python-UNO bridge for advanced page setup control.

Key features ported from the original:
- Smart page size: fits all columns on one page width (FitToPagesWide=1)
- Paper catalog with best-fit selection (A4 → Letter → A3 → Tabloid → etc.)
- Auto orientation: landscape for wide spreadsheets
- Content dimension detection via UNO cursor
- Narrow margins (0.5") for maximum content area
- Visible sheets only export (skips hidden sheets)

Falls back to basic LibreOffice CLI if UNO connection fails.
"""
import subprocess
import os
import time
from pathlib import Path
from typing import Optional, Tuple

from src.logger import logger

# Supported Excel extensions
EXCEL_EXTENSIONS = {'.xls', '.xlsx', '.xlsm'}

# LibreOffice binary path
LIBREOFFICE_BIN = os.environ.get('LIBREOFFICE_PATH', 'libreoffice')

# Conversion timeout in seconds
CONVERSION_TIMEOUT = int(os.environ.get('CONVERSION_TIMEOUT', '300'))

# Constants
POINTS_PER_INCH = 72
MM_PER_INCH = 25.4
TWIPS_PER_INCH = 1440  # UNO uses 1/100mm internally but page sizes in mm

# UNO paper sizes (com.sun.star.view.PaperFormat values)
# LibreOffice uses different paper enums than Excel COM
UNO_PAPER_A4 = 9      # PAPER_A4
UNO_PAPER_LETTER = 1  # PAPER_LETTER
UNO_PAPER_LEGAL = 5   # PAPER_LEGAL
UNO_PAPER_TABLOID = 3 # PAPER_TABLOID
UNO_PAPER_A3 = 8      # PAPER_A3
UNO_PAPER_B4 = 12     # PAPER_B4_JIS
UNO_PAPER_B3 = 13     # PAPER_B3_JIS
UNO_PAPER_A2 = 66     # PAPER_A2
UNO_PAPER_USER = 256  # PAPER_USER (custom)

# Paper catalog: (name, width_inches, height_inches, orientation)
# Sorted by effective width ascending for best-fit selection.
# Matches the original Excel converter paper_catalog exactly.
PAPER_CATALOG = [
    ('A4',      8.27,  11.69, 'portrait'),
    ('Letter',  8.50,  11.00, 'portrait'),
    ('Legal',   8.50,  14.00, 'portrait'),
    ('B4',      9.84,  13.90, 'portrait'),
    ('Letter', 11.00,   8.50, 'landscape'),
    ('Tabloid',11.00,  17.00, 'portrait'),
    ('A3',     11.69,  16.54, 'portrait'),
    ('A4',     11.69,   8.27, 'landscape'),
    ('B4',     13.90,   9.84, 'landscape'),
    ('B3',     13.90,  19.70, 'portrait'),
    ('Legal',  14.00,   8.50, 'landscape'),
    ('A2',     16.54,  23.39, 'portrait'),
    ('A3',     16.54,  11.69, 'landscape'),
    ('Tabloid',17.00,  11.00, 'landscape'),
    ('B3',     19.70,  13.90, 'landscape'),
    ('A2',     23.39,  16.54, 'landscape'),
]

# Default page shrink threshold (10%): content up to 10% wider than paper is acceptable
DEFAULT_SHRINK_THRESHOLD = 0.10


def convert_excel_to_pdf(input_path: str, output_dir: str) -> str:
    """
    Convert an Excel spreadsheet to PDF.

    Attempts UNO-based conversion with smart page setup first.
    Falls back to basic LibreOffice CLI if UNO fails.

    @param input_path: Absolute path to the Excel file.
    @param output_dir: Directory where the PDF will be saved.
    @returns: Absolute path to the generated PDF file.
    @raises: RuntimeError if conversion fails.
    """
    input_file = Path(input_path)
    pdf_name = input_file.stem + '.pdf'
    output_path = os.path.join(output_dir, pdf_name)

    os.makedirs(output_dir, exist_ok=True)

    # Try UNO-based conversion first (smart page sizing)
    try:
        _convert_with_uno(input_path, output_path)
        logger.info(f'Excel converted via UNO: {input_file.name} -> {pdf_name}')
        return output_path
    except Exception as e:
        logger.warning(f'UNO conversion failed, falling back to CLI: {e}')

    # Fallback: basic LibreOffice CLI
    _convert_with_cli(input_path, output_dir)

    if not os.path.exists(output_path):
        raise RuntimeError(
            f'LibreOffice produced no PDF output for: {input_file.name}'
        )

    logger.info(f'Excel converted via CLI: {input_file.name} -> {pdf_name}')
    return output_path


def _convert_with_cli(input_path: str, output_dir: str) -> None:
    """
    Fallback: convert Excel using LibreOffice headless CLI.
    No smart page sizing — uses LibreOffice defaults.
    """
    cmd = [
        LIBREOFFICE_BIN,
        '--headless',
        '--norestore',
        '--convert-to', 'pdf',
        '--outdir', output_dir,
        input_path,
    ]

    logger.info(f'Running LibreOffice CLI: {" ".join(cmd)}')

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=CONVERSION_TIMEOUT,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f'Excel CLI conversion failed (exit {result.returncode}): '
                f'{result.stderr}'
            )
    except subprocess.TimeoutExpired:
        raise RuntimeError(
            f'Excel CLI conversion timed out after {CONVERSION_TIMEOUT}s'
        )


def _convert_with_uno(input_path: str, output_path: str) -> None:
    """
    Convert Excel to PDF using Python-UNO bridge with smart page setup.

    Replicates the original ExcelConverter logic:
    1. Open the spreadsheet via UNO
    2. For each visible sheet:
       a. Get content dimensions (last used row/col)
       b. Calculate content width in inches
       c. Select best paper size from catalog
       d. Set FitToPagesWide = 1 (fit all columns on one page width)
       e. Set narrow margins (0.5")
       f. Set auto orientation (landscape for wide sheets)
    3. Export all visible sheets to PDF

    @param input_path: Path to the Excel file.
    @param output_path: Full path for the output PDF.
    """
    import uno  # type: ignore
    from com.sun.star.beans import PropertyValue  # type: ignore

    # Start a headless LibreOffice instance for UNO
    lo_process = subprocess.Popen(
        [
            LIBREOFFICE_BIN,
            '--headless',
            '--norestore',
            '--accept=socket,host=localhost,port=2002;urp;',
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        # Connect to LibreOffice via UNO
        local_context = uno.getComponentContext()
        resolver = local_context.ServiceManager.createInstanceWithContext(
            'com.sun.star.bridge.UnoUrlResolver', local_context
        )

        # Wait for LibreOffice to start accepting connections
        ctx = None
        for attempt in range(30):
            try:
                ctx = resolver.resolve(
                    'uno:socket,host=localhost,port=2002;'
                    'urp;StarOffice.ComponentContext'
                )
                break
            except Exception:
                time.sleep(1)

        if ctx is None:
            raise RuntimeError('Could not connect to LibreOffice via UNO')

        smgr = ctx.ServiceManager
        desktop = smgr.createInstanceWithContext(
            'com.sun.star.frame.Desktop', ctx
        )

        # Open the spreadsheet
        file_url = uno.systemPathToFileUrl(os.path.abspath(input_path))
        doc = desktop.loadComponentFromURL(
            file_url, '_blank', 0,
            (_make_property('Hidden', True),)
        )

        if doc is None:
            raise RuntimeError(f'Failed to open document: {input_path}')

        try:
            sheets = doc.getSheets()
            visible_count = 0

            for i in range(sheets.getCount()):
                sheet = sheets.getByIndex(i)

                # Skip hidden sheets (mirrors original logic)
                if not sheet.isVisible():
                    logger.debug(f'Skipping hidden sheet: {sheet.getName()}')
                    continue

                visible_count += 1
                sheet_name = sheet.getName()
                logger.info(f'Processing sheet: {sheet_name}')

                # Get content dimensions
                content_width_inches, last_col = _get_content_dimensions(sheet)

                if last_col == 0:
                    logger.info(f'Skipping empty sheet: {sheet_name}')
                    continue

                # Apply smart page setup
                _apply_smart_page_setup(sheet, content_width_inches, last_col, doc)

            if visible_count == 0:
                raise RuntimeError(f'No visible sheets in: {input_path}')

            # Export to PDF
            pdf_url = uno.systemPathToFileUrl(os.path.abspath(output_path))

            # Build PDF export filter data
            filter_data = _make_property('FilterData', uno.Any(
                '[]com.sun.star.beans.PropertyValue',
                (
                    _make_property('UseLosslessCompression', False),
                    _make_property('Quality', 90),
                    _make_property('IsSkipEmptyPages', True),
                ),
            ))

            doc.storeToURL(pdf_url, (
                _make_property('FilterName', 'calc_pdf_Export'),
                filter_data,
            ))

        finally:
            doc.close(True)

    finally:
        lo_process.terminate()
        try:
            lo_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            lo_process.kill()


def _get_content_dimensions(sheet) -> Tuple[float, int]:
    """
    Get the content dimensions of a sheet using UNO cursor.

    Replicates the original _get_content_dimensions_points logic:
    - Creates a cursor covering the entire used area
    - Gets the last used row and column
    - Calculates total content width by summing column widths

    @param sheet: UNO Sheet object.
    @returns: Tuple of (content_width_inches, last_col_index_1based).
    """
    try:
        # Create cursor covering the used area
        cursor = sheet.createCursor()
        cursor.gotoStartOfUsedArea(False)
        cursor.gotoEndOfUsedArea(True)

        range_addr = cursor.getRangeAddress()
        last_row = range_addr.EndRow + 1  # 0-based to 1-based
        last_col = range_addr.EndColumn + 1  # 0-based to 1-based

        if last_row == 0 or last_col == 0:
            return 0.0, 0

        # Calculate total content width by summing column widths
        # UNO column widths are in 1/100mm
        total_width_100mm = 0
        columns = sheet.getColumns()
        for col_idx in range(last_col):
            try:
                col = columns.getByIndex(col_idx)
                total_width_100mm += col.getPropertyValue('Width')
            except Exception:
                total_width_100mm += 2268  # Default ~0.9" (2268 = ~22.68mm)

        # Convert 1/100mm to inches
        content_width_inches = (total_width_100mm / 100.0) / MM_PER_INCH

        logger.debug(
            f'Sheet dimensions: {last_row} rows x {last_col} cols, '
            f'width: {content_width_inches:.2f}"'
        )

        return content_width_inches, last_col

    except Exception as e:
        logger.warning(f'Could not get content dimensions: {e}')
        return 8.5, 1  # Fallback to letter width


def _apply_smart_page_setup(
    sheet,
    content_width_inches: float,
    last_col: int,
    doc,
) -> None:
    """
    Apply smart page setup to a sheet.

    Replicates the original _apply_page_setup logic:
    1. Calculate needed page width from content
    2. Select best paper size from catalog (smallest that fits)
    3. Set FitToPagesWide = 1
    4. Set FitToPagesTall = 0 (auto)
    5. Apply narrow margins (0.5")
    6. Set orientation based on content width

    @param sheet: UNO Sheet object.
    @param content_width_inches: Total content width in inches.
    @param last_col: Last used column index (1-based).
    @param doc: UNO Document object.
    """
    sheet_name = sheet.getName()

    try:
        # Get the page style for this sheet
        page_style_name = sheet.getPropertyValue('PageStyle')
        page_styles = doc.getStyleFamilies().getByName('PageStyles')
        page_style = page_styles.getByName(page_style_name)

        # Add margin buffer (same as original: 0.5")
        needed_width = content_width_inches + 0.5

        # Auto orientation: landscape if content is wider than 8.5" (Letter portrait)
        use_landscape = needed_width > 8.5

        # Select best paper size from catalog
        paper = _select_paper_size(needed_width, use_landscape)
        paper_name, paper_width_in, paper_height_in, paper_orient = paper

        # Set orientation
        # UNO orientation: 0 = Portrait, 1 = Landscape
        is_landscape = (paper_orient == 'landscape')
        page_style.setPropertyValue('IsLandscape', is_landscape)

        # Set paper size in 1/100mm
        if is_landscape:
            # In landscape, Width > Height in the physical dimension
            w_100mm = int(paper_width_in * MM_PER_INCH * 100)
            h_100mm = int(paper_height_in * MM_PER_INCH * 100)
        else:
            w_100mm = int(paper_width_in * MM_PER_INCH * 100)
            h_100mm = int(paper_height_in * MM_PER_INCH * 100)

        # UNO Size uses width/height in 1/100mm
        from com.sun.star.awt import Size  # type: ignore
        page_style.setPropertyValue('Size', Size(w_100mm, h_100mm))

        # Set FitToPagesWide = 1 (fit all columns on one page width)
        # ScaleToPagesX = number of pages wide (1 = fit to 1 page wide)
        page_style.setPropertyValue('ScaleToPagesX', 1)
        # ScaleToPagesY = 0 means auto (as many pages tall as needed)
        page_style.setPropertyValue('ScaleToPagesY', 0)

        # Set narrow margins (0.5" = 1270 in 1/100mm)
        margin_100mm = int(0.5 * MM_PER_INCH * 100)
        page_style.setPropertyValue('LeftMargin', margin_100mm)
        page_style.setPropertyValue('RightMargin', margin_100mm)
        page_style.setPropertyValue('TopMargin', margin_100mm)
        page_style.setPropertyValue('BottomMargin', margin_100mm)

        orient_label = 'Landscape' if is_landscape else 'Portrait'
        logger.info(
            f"Sheet '{sheet_name}': {orient_label} {paper_name} "
            f"({paper_width_in:.2f}\" x {paper_height_in:.2f}\") "
            f"for content width {content_width_inches:.2f}\""
        )

    except Exception as e:
        logger.warning(
            f"Could not apply smart page setup for '{sheet_name}': {e}. "
            f"Using default page settings."
        )


def _select_paper_size(
    needed_width: float,
    prefer_landscape: bool = False,
    shrink_threshold: float = DEFAULT_SHRINK_THRESHOLD,
) -> Tuple[str, float, float, str]:
    """
    Select the best paper size from the catalog.

    Replicates the original paper selection algorithm:
    1. Filter by preferred orientation (or use all if auto)
    2. Find exact candidates (paper_width >= needed_width)
    3. Find shrink candidates (within shrink_threshold)
    4. Prefer shrink if it wastes less than exact fit
    5. Fallback to largest available paper

    @param needed_width: Required page width in inches.
    @param prefer_landscape: Whether to prefer landscape orientation.
    @param shrink_threshold: Acceptable shrink percentage (default 10%).
    @returns: Tuple of (name, width, height, orientation).
    """
    # Filter catalog by orientation preference
    if prefer_landscape:
        filtered = [p for p in PAPER_CATALOG if p[3] == 'landscape']
    else:
        # For auto/portrait: include all orientations
        filtered = list(PAPER_CATALOG)

    if not filtered:
        filtered = list(PAPER_CATALOG)

    # Find exact candidates (paper width >= needed width)
    exact = [p for p in filtered if p[1] >= needed_width]

    # Find shrink candidates (within threshold)
    shrink = []
    if shrink_threshold > 0:
        min_acceptable = needed_width / (1 + shrink_threshold)
        shrink = [
            p for p in filtered
            if p[1] < needed_width and p[1] >= min_acceptable
        ]

    # Decision: prefer shrink if it wastes less
    if shrink and exact:
        best_shrink = shrink[-1]   # Largest within shrink range
        best_exact = exact[0]      # Smallest that fits

        exact_waste = best_exact[1] - needed_width
        shrink_amount = needed_width - best_shrink[1]

        if exact_waste > shrink_amount:
            return best_shrink
        return best_exact
    elif exact:
        return exact[0]
    elif shrink:
        return shrink[-1]
    else:
        # Content exceeds all papers — use largest available
        return filtered[-1]


def _make_property(name: str, value) -> 'PropertyValue':
    """Create a UNO PropertyValue."""
    from com.sun.star.beans import PropertyValue  # type: ignore
    prop = PropertyValue()
    prop.Name = name
    prop.Value = value
    return prop


def is_excel_file(filename: str) -> bool:
    """Check if filename has an Excel extension."""
    return Path(filename).suffix.lower() in EXCEL_EXTENSIONS
