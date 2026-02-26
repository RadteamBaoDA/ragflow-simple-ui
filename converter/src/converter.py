"""
Converter Module — dispatches Office→PDF conversion to type-specific converters.

This module acts as the main entry point for document conversion.
It determines the file type and routes to the appropriate converter:

- Word (.doc, .docx, .docm)        → word_converter.py (LibreOffice CLI)
- PowerPoint (.ppt, .pptx, .pptm)  → powerpoint_converter.py (LibreOffice CLI)
- Excel (.xls, .xlsx, .xlsm)       → excel_converter.py (Python-UNO with smart page sizing)
"""
from pathlib import Path

from src.logger import logger
from src.word_converter import convert_word_to_pdf, is_word_file, WORD_EXTENSIONS
from src.powerpoint_converter import convert_powerpoint_to_pdf, is_powerpoint_file, POWERPOINT_EXTENSIONS
from src.excel_converter import convert_excel_to_pdf, is_excel_file, EXCEL_EXTENSIONS

# All supported Office extensions
ALL_OFFICE_EXTENSIONS = WORD_EXTENSIONS | POWERPOINT_EXTENSIONS | EXCEL_EXTENSIONS

# PDF extension
PDF_EXTENSION = '.pdf'


def convert_to_pdf(input_path: str, output_dir: str) -> str:
    """
    Convert an Office document to PDF by dispatching to the correct converter.

    @param input_path: Absolute path to the input document.
    @param output_dir: Directory where the PDF will be saved.
    @returns: Absolute path to the generated PDF file.
    @raises: RuntimeError if conversion fails.
    @raises: ValueError if file type is unsupported.
    """
    filename = Path(input_path).name
    ext = Path(input_path).suffix.lower()
    logger.debug(f'Dispatching conversion: file={filename}, ext={ext}')

    if is_word_file(filename):
        logger.info(f'Routing to Word converter: {filename}')
        return convert_word_to_pdf(input_path, output_dir)

    elif is_powerpoint_file(filename):
        logger.info(f'Routing to PowerPoint converter: {filename}')
        return convert_powerpoint_to_pdf(input_path, output_dir)

    elif is_excel_file(filename):
        logger.info(f'Routing to Excel converter: {filename}')
        return convert_excel_to_pdf(input_path, output_dir)

    else:
        logger.error(f'Unsupported file type: {filename} (ext={ext})')
        raise ValueError(f'Unsupported file type: {filename}')


def is_office_file(filename: str) -> bool:
    """
    Check if a filename has a supported Office document extension.

    @param filename: File name to check.
    @returns: True if the file is a supported Office format.
    """
    return Path(filename).suffix.lower() in ALL_OFFICE_EXTENSIONS


def is_pdf_file(filename: str) -> bool:
    """
    Check if a filename is a PDF.

    @param filename: File name to check.
    @returns: True if the file is a PDF.
    """
    return Path(filename).suffix.lower() == PDF_EXTENSION
