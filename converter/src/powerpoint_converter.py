"""
PowerPoint Converter — converts .ppt, .pptx, .pptm to PDF using LibreOffice headless.

Ports the logic from client/src/core/powerpoint_converter.py (Windows COM)
to LibreOffice CLI on Linux.

Original COM logic:
- Open presentation (ReadOnly, WithWindow=False)
- Export via SaveAs with ppSaveAsPDF=32
- Settings: color mode, slide range, intent (Print/Screen)

LibreOffice equivalent:
- libreoffice --headless --convert-to pdf <file>
- Handles slides, transitions, animations automatically
- Preserves slide layout, fonts, and embedded media
"""
import subprocess
import os
from pathlib import Path

from src.logger import logger

# Supported PowerPoint extensions
POWERPOINT_EXTENSIONS = {'.ppt', '.pptx', '.pptm'}

# LibreOffice binary path
LIBREOFFICE_BIN = os.environ.get('LIBREOFFICE_PATH', 'libreoffice')

# Conversion timeout in seconds
CONVERSION_TIMEOUT = int(os.environ.get('CONVERSION_TIMEOUT', '300'))


def convert_powerpoint_to_pdf(input_path: str, output_dir: str) -> str:
    """
    Convert a PowerPoint presentation to PDF using LibreOffice headless.

    LibreOffice handles export automatically including:
    - All slides rendered at full quality
    - Color mode preservation (full color output)
    - Font embedding and substitution
    - Slide layout and master slide rendering
    - Embedded images, charts, and shapes

    @param input_path: Absolute path to the PowerPoint file.
    @param output_dir: Directory where the PDF will be saved.
    @returns: Absolute path to the generated PDF file.
    @raises: RuntimeError if conversion fails or times out.
    """
    input_file = Path(input_path)
    pdf_name = input_file.stem + '.pdf'
    output_path = os.path.join(output_dir, pdf_name)

    os.makedirs(output_dir, exist_ok=True)

    cmd = [
        LIBREOFFICE_BIN,
        '--headless',
        '--norestore',
        '--convert-to', 'pdf',
        '--outdir', output_dir,
        input_path,
    ]

    logger.info(f'Converting PowerPoint: {input_file.name}')
    logger.debug(f'Input: {input_path}')
    logger.debug(f'Output dir: {output_dir}')
    logger.debug(f'Command: {" ".join(cmd)}')

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=CONVERSION_TIMEOUT,
        )

        if result.returncode != 0:
            logger.error(f'LibreOffice stderr: {result.stderr}')
            raise RuntimeError(
                f'PowerPoint conversion failed (exit {result.returncode}): '
                f'{result.stderr}'
            )

        # Log stdout for diagnostics
        if result.stdout.strip():
            logger.debug(f'LibreOffice stdout: {result.stdout.strip()}')

    except subprocess.TimeoutExpired:
        raise RuntimeError(
            f'PowerPoint conversion timed out after {CONVERSION_TIMEOUT}s: '
            f'{input_file.name}'
        )

    if not os.path.exists(output_path):
        logger.error(f'Expected PDF not found at: {output_path}')
        raise RuntimeError(
            f'LibreOffice produced no PDF output for: {input_file.name}'
        )

    file_size = os.path.getsize(output_path)
    logger.success(f'PowerPoint converted: {input_file.name} -> {pdf_name} ({file_size:,} bytes)')
    return output_path


def is_powerpoint_file(filename: str) -> bool:
    """Check if filename has a PowerPoint extension."""
    return Path(filename).suffix.lower() in POWERPOINT_EXTENSIONS
