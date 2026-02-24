from typing import Protocol, Optional
from pathlib import Path
from ..config import PDFConversionSettings

class Converter(Protocol):
    """
    Protocol for document converters.
    """
    def convert(self, input_path: Path, output_path: Optional[Path] = None, settings: Optional[PDFConversionSettings] = None, base_path: Optional[Path] = None) -> Path:
        """
        Convert a document to PDF.
        
        Args:
            input_path: Path to the source document.
            output_path: Optional path for the output PDF. 
                         If not provided, defaults to input filename with .pdf extension.
            settings: conversion configuration settings.
            
        Returns:
            Path to the generated PDF file.
        """
        ...
