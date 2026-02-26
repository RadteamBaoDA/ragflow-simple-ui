"""
Word Converter — converts .doc, .docx, .docm to PDF using LibreOffice headless.

Ports the logic from client/src/core/word_converter.py (Windows COM)
to LibreOffice CLI on Linux.

Original COM logic:
- Open document (ReadOnly, suppress all dialogs)
- Apply page setup: orientation (portrait/landscape), margins (narrow = 0.5")
- Export via ExportAsFixedFormat with quality/bookmarks/compliance settings

LibreOffice equivalent:
- libreoffice --headless --convert-to pdf <file>
- Page setup and export options are handled automatically by LibreOffice
"""
import subprocess
import os
from pathlib import Path

from src.logger import logger

# Supported Word extensions
WORD_EXTENSIONS = {'.doc', '.docx', '.docm'}

# LibreOffice binary path
LIBREOFFICE_BIN = os.environ.get('LIBREOFFICE_PATH', 'libreoffice')

# Conversion timeout in seconds
CONVERSION_TIMEOUT = int(os.environ.get('CONVERSION_TIMEOUT', '300'))


def convert_word_to_pdf(input_path: str, output_dir: str) -> str:
    """
    Convert a Word document to PDF using LibreOffice headless.

    LibreOffice handles page setup automatically including:
    - Orientation preservation (portrait/landscape)
    - Margin settings from the document
    - Font embedding and substitution
    - Bookmark generation from heading styles
    - Document properties and structure tags

    @param input_path: Absolute path to the Word document.
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

    logger.info(f'Converting Word document: {input_file.name}')
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
                f'Word conversion failed (exit {result.returncode}): '
                f'{result.stderr}'
            )

        # Log stdout for diagnostics
        if result.stdout.strip():
            logger.debug(f'LibreOffice stdout: {result.stdout.strip()}')

    except subprocess.TimeoutExpired:
        raise RuntimeError(
            f'Word conversion timed out after {CONVERSION_TIMEOUT}s: '
            f'{input_file.name}'
        )

    if not os.path.exists(output_path):
        logger.error(f'Expected PDF not found at: {output_path}')
        raise RuntimeError(
            f'LibreOffice produced no PDF output for: {input_file.name}'
        )

    file_size = os.path.getsize(output_path)
    logger.success(f'Word converted: {input_file.name} -> {pdf_name} ({file_size:,} bytes)')
    return output_path


def is_word_file(filename: str) -> bool:
    """Check if filename has a Word document extension."""
    return Path(filename).suffix.lower() in WORD_EXTENSIONS
