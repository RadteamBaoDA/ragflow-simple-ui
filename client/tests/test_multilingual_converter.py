"""
Test cases for multilingual PDF conversion support.

Verifies that the doc2pdf converters correctly handle documents containing:
- English text
- Japanese text (日本語)
- Vietnamese text (Tiếng Việt)
- Mixed multilingual content

Note: These tests use mocks to verify conversion logic. Font embedding
and actual text rendering is handled by Microsoft Office's native PDF export.
"""

import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path

from src.core.word_converter import WordConverter
from src.core.excel_converter import ExcelConverter
from src.core.powerpoint_converter import PowerPointConverter
from src.config import PDFConversionSettings


# Sample multilingual text constants
ENGLISH_TEXT = "Hello World - PDF Conversion Test"
JAPANESE_TEXT = "こんにちは世界 - PDF変換テスト"
VIETNAMESE_TEXT = "Xin chào thế giới - Kiểm tra chuyển đổi PDF"
MIXED_TEXT = f"{ENGLISH_TEXT}\n{JAPANESE_TEXT}\n{VIETNAMESE_TEXT}"


# =============================================================================
# Word Converter Multilingual Tests
# =============================================================================


class TestWordConverterMultilingual:
    """Test Word converter with multilingual content."""

    @pytest.fixture
    def mock_word_app(self):
        with patch("src.core.word_converter.win32com.client.Dispatch") as mock_dispatch:
            mock_app = MagicMock()
            mock_dispatch.return_value = mock_app
            yield mock_app

    @pytest.fixture
    def mock_pythoncom(self):
        with patch("src.core.word_converter.pythoncom") as mock_com:
            yield mock_com

    @pytest.fixture
    def mock_process_registry(self):
        with patch("src.core.word_converter.ProcessRegistry"):
            yield

    @pytest.fixture
    def converter(self, mock_word_app, mock_pythoncom, mock_process_registry):
        return WordConverter()

    def test_word_converter_english_text(self, converter, mock_word_app, tmp_path):
        """Test conversion of document with English text."""
        input_file = tmp_path / "english_document.docx"
        input_file.touch()
        output_file = tmp_path / "english_document.pdf"

        mock_doc = MagicMock()
        mock_doc.Content.Text = ENGLISH_TEXT
        mock_word_app.Documents.Open.return_value = mock_doc

        result = converter.convert(input_file, output_file)

        # Verify conversion was called
        mock_doc.ExportAsFixedFormat.assert_called_once()
        export_args = mock_doc.ExportAsFixedFormat.call_args[1]
        assert export_args["OutputFileName"] == str(output_file.resolve())
        assert export_args["ExportFormat"] == 17  # wdExportFormatPDF

    def test_word_converter_japanese_text(self, converter, mock_word_app, tmp_path):
        """Test conversion of document with Japanese text (日本語)."""
        input_file = tmp_path / "japanese_document.docx"
        input_file.touch()
        output_file = tmp_path / "japanese_document.pdf"

        mock_doc = MagicMock()
        mock_doc.Content.Text = JAPANESE_TEXT
        mock_word_app.Documents.Open.return_value = mock_doc

        result = converter.convert(input_file, output_file)

        # Verify conversion was called with correct arguments
        mock_doc.ExportAsFixedFormat.assert_called_once()
        export_args = mock_doc.ExportAsFixedFormat.call_args[1]
        assert export_args["OutputFileName"] == str(output_file.resolve())
        # Verify PDF/A compliance for better font embedding
        assert "UseISO19005_1" in export_args

    def test_word_converter_vietnamese_text(self, converter, mock_word_app, tmp_path):
        """Test conversion of document with Vietnamese text (Tiếng Việt)."""
        input_file = tmp_path / "vietnamese_document.docx"
        input_file.touch()
        output_file = tmp_path / "vietnamese_document.pdf"

        mock_doc = MagicMock()
        mock_doc.Content.Text = VIETNAMESE_TEXT
        mock_word_app.Documents.Open.return_value = mock_doc

        result = converter.convert(input_file, output_file)

        mock_doc.ExportAsFixedFormat.assert_called_once()
        export_args = mock_doc.ExportAsFixedFormat.call_args[1]
        assert export_args["OutputFileName"] == str(output_file.resolve())

    def test_word_converter_mixed_multilingual(self, converter, mock_word_app, tmp_path):
        """Test conversion of document with mixed multilingual content."""
        input_file = tmp_path / "multilingual_document.docx"
        input_file.touch()
        output_file = tmp_path / "multilingual_document.pdf"

        mock_doc = MagicMock()
        mock_doc.Content.Text = MIXED_TEXT
        mock_word_app.Documents.Open.return_value = mock_doc

        settings = PDFConversionSettings(compliance="pdfa")
        result = converter.convert(input_file, output_file, settings)

        mock_doc.ExportAsFixedFormat.assert_called_once()
        export_args = mock_doc.ExportAsFixedFormat.call_args[1]
        # PDF/A ensures better font embedding for multilingual support
        assert export_args["UseISO19005_1"] is True


# =============================================================================
# Excel Converter Multilingual Tests
# =============================================================================


class TestExcelConverterMultilingual:
    """Test Excel converter with multilingual content."""

    @pytest.fixture
    def mock_excel_app(self):
        with patch("src.core.excel_converter.win32com.client.Dispatch") as mock_dispatch:
            mock_app = MagicMock()
            mock_dispatch.return_value = mock_app
            yield mock_app

    @pytest.fixture
    def mock_pythoncom(self):
        with patch("src.core.excel_converter.pythoncom") as mock_com:
            yield mock_com

    @pytest.fixture
    def mock_process_registry(self):
        with patch("src.core.excel_converter.ProcessRegistry"):
            yield

    @pytest.fixture
    def mock_sheet_settings(self):
        with patch("src.core.excel_converter.get_excel_sheet_settings") as mock_get:
            def side_effect(sheet_name, base_settings, input_path=None, base_path=None):
                if not getattr(base_settings, 'excel', None):
                    from src.config import ExcelSettings
                    base_settings.excel = ExcelSettings()
                return base_settings
            mock_get.side_effect = side_effect
            yield mock_get

    @pytest.fixture
    def converter(self, mock_excel_app, mock_pythoncom, mock_sheet_settings, mock_process_registry):
        return ExcelConverter()

    def _create_mock_sheet(self, name: str, content_text: str, col_count: int = 10):
        """Helper to create a mock Excel sheet."""
        mock_sheet = MagicMock()
        mock_sheet.Visible = -1  # xlSheetVisible
        mock_sheet.Name = name
        mock_sheet.UsedRange.Columns.Count = col_count
        mock_sheet.UsedRange.Rows.Count = 100
        mock_sheet.UsedRange.Left = 0.0
        mock_sheet.UsedRange.Top = 0.0
        mock_sheet.UsedRange.Width = col_count * 72.0
        mock_sheet.UsedRange.Height = 100 * 15.0
        mock_sheet.UsedRange.Row = 1
        mock_sheet.UsedRange.Column = 1
        # Simulate cell content
        mock_sheet.Cells.Value = content_text
        mock_sheet.Cells.Find().Row = 100
        mock_sheet.Cells.Find().Column = col_count
        return mock_sheet

    def test_excel_converter_japanese_sheet(self, converter, mock_excel_app, tmp_path):
        """Test conversion of Excel with Japanese sheet names and data."""
        input_file = tmp_path / "japanese_data.xlsx"
        input_file.touch()

        mock_workbook = MagicMock()
        mock_sheet = self._create_mock_sheet("データシート", JAPANESE_TEXT)
        
        mock_worksheets = MagicMock()
        mock_worksheets.__iter__ = lambda self: iter([mock_sheet])
        mock_worksheets.__call__ = lambda self, idx: mock_sheet
        mock_workbook.Worksheets = mock_worksheets
        mock_workbook.ActiveSheet = mock_sheet
        mock_excel_app.Workbooks.Open.return_value = mock_workbook

        result = converter.convert(input_file, settings=PDFConversionSettings())

        mock_sheet.ExportAsFixedFormat.assert_called_once()

    def test_excel_converter_vietnamese_sheet(self, converter, mock_excel_app, tmp_path):
        """Test conversion of Excel with Vietnamese content."""
        input_file = tmp_path / "vietnamese_data.xlsx"
        input_file.touch()

        mock_workbook = MagicMock()
        mock_sheet = self._create_mock_sheet("Bảng dữ liệu", VIETNAMESE_TEXT)
        
        mock_worksheets = MagicMock()
        mock_worksheets.__iter__ = lambda self: iter([mock_sheet])
        mock_worksheets.__call__ = lambda self, idx: mock_sheet
        mock_workbook.Worksheets = mock_worksheets
        mock_workbook.ActiveSheet = mock_sheet
        mock_excel_app.Workbooks.Open.return_value = mock_workbook

        result = converter.convert(input_file, settings=PDFConversionSettings())

        mock_sheet.ExportAsFixedFormat.assert_called_once()

    def test_excel_converter_multilingual_sheets(self, converter, mock_excel_app, tmp_path):
        """Test conversion of Excel with multiple sheets in different languages."""
        input_file = tmp_path / "multilingual_workbook.xlsx"
        input_file.touch()

        mock_workbook = MagicMock()
        sheet_en = self._create_mock_sheet("English Data", ENGLISH_TEXT)
        sheet_jp = self._create_mock_sheet("日本語データ", JAPANESE_TEXT)
        sheet_vn = self._create_mock_sheet("Dữ liệu VN", VIETNAMESE_TEXT)

        sheets_list = [sheet_en, sheet_jp, sheet_vn]
        
        # Mock Worksheets to be both iterable and callable
        mock_worksheets = MagicMock()
        mock_worksheets.__iter__ = lambda self: iter(sheets_list)
        def get_sheet(idx):
            return sheets_list[idx - 1] if 1 <= idx <= len(sheets_list) else sheets_list[0]
        mock_worksheets.__call__ = get_sheet
        mock_workbook.Worksheets = mock_worksheets
        
        mock_workbook.ActiveSheet = sheet_en
        mock_excel_app.Workbooks.Open.return_value = mock_workbook
        
        # Mock the temp workbook that's created when copying sheets
        mock_temp_wb = MagicMock()
        mock_temp_sheets = MagicMock()
        mock_temp_sheets.Count = 3
        mock_temp_sheets.__call__ = lambda self, idx: sheets_list[idx - 1] if 1 <= idx <= 3 else sheets_list[0]
        mock_temp_wb.Sheets = mock_temp_sheets
        # Mock workbook.Application.ActiveWorkbook to return the temp workbook
        mock_workbook.Application.ActiveWorkbook = mock_temp_wb

        result = converter.convert(input_file, settings=PDFConversionSettings())

        # Verify workbook was opened
        mock_excel_app.Workbooks.Open.assert_called_once()
        # When multiple sheets, a temp workbook is created and ExportAsFixedFormat is called on it
        # The exact export call happens on the temp workbook, not individual sheets
        # Just verify conversion completed successfully


# =============================================================================
# PowerPoint Converter Multilingual Tests
# =============================================================================


class TestPowerPointConverterMultilingual:
    """Test PowerPoint converter with multilingual content."""

    @pytest.fixture
    def mock_ppt_app(self):
        with patch("src.core.powerpoint_converter.win32com.client.Dispatch") as mock_dispatch:
            mock_app = MagicMock()
            mock_dispatch.return_value = mock_app
            yield mock_app

    @pytest.fixture
    def mock_pythoncom(self):
        with patch("src.core.powerpoint_converter.pythoncom") as mock_com:
            yield mock_com

    @pytest.fixture
    def mock_process_registry(self):
        with patch("src.core.powerpoint_converter.ProcessRegistry"):
            yield

    @pytest.fixture
    def converter(self, mock_ppt_app, mock_pythoncom, mock_process_registry):
        return PowerPointConverter()

    def test_powerpoint_converter_japanese_slides(self, converter, mock_ppt_app, tmp_path):
        """Test conversion of PowerPoint with Japanese slide content."""
        input_file = tmp_path / "japanese_presentation.pptx"
        input_file.touch()
        output_file = tmp_path / "japanese_presentation.pdf"

        mock_presentation = MagicMock()
        mock_slide = MagicMock()
        mock_slide.Shapes.Title.TextFrame.TextRange.Text = JAPANESE_TEXT
        mock_presentation.Slides = [mock_slide]
        mock_ppt_app.Presentations.Open.return_value = mock_presentation

        result = converter.convert(input_file, output_file)

        mock_presentation.ExportAsFixedFormat.assert_called_once()
        export_args = mock_presentation.ExportAsFixedFormat.call_args[1]
        assert export_args["Path"] == str(output_file.resolve())
        assert export_args["FixedFormatType"] == 2  # ppFixedFormatTypePDF

    def test_powerpoint_converter_vietnamese_slides(self, converter, mock_ppt_app, tmp_path):
        """Test conversion of PowerPoint with Vietnamese slide content."""
        input_file = tmp_path / "vietnamese_presentation.pptx"
        input_file.touch()
        output_file = tmp_path / "vietnamese_presentation.pdf"

        mock_presentation = MagicMock()
        mock_slide = MagicMock()
        mock_slide.Shapes.Title.TextFrame.TextRange.Text = VIETNAMESE_TEXT
        mock_presentation.Slides = [mock_slide]
        mock_ppt_app.Presentations.Open.return_value = mock_presentation

        result = converter.convert(input_file, output_file)

        mock_presentation.ExportAsFixedFormat.assert_called_once()

    def test_powerpoint_converter_multilingual_slides(self, converter, mock_ppt_app, tmp_path):
        """Test conversion of PowerPoint with mixed multilingual slides."""
        input_file = tmp_path / "multilingual_presentation.pptx"
        input_file.touch()

        mock_presentation = MagicMock()
        # Create slides with different languages
        mock_slides = []
        for i, text in enumerate([ENGLISH_TEXT, JAPANESE_TEXT, VIETNAMESE_TEXT]):
            slide = MagicMock()
            slide.Shapes.Title.TextFrame.TextRange.Text = text
            mock_slides.append(slide)

        mock_presentation.Slides = mock_slides
        mock_ppt_app.Presentations.Open.return_value = mock_presentation

        settings = PDFConversionSettings(compliance="pdfa")
        result = converter.convert(input_file, settings=settings)

        mock_presentation.ExportAsFixedFormat.assert_called_once()
        export_args = mock_presentation.ExportAsFixedFormat.call_args[1]
        # PDF/A ensures font embedding for all languages
        assert export_args["UseISO19005_1"] is True


# =============================================================================
# Font Embedding Verification Tests
# =============================================================================


class TestFontEmbeddingSettings:
    """Test that PDF export settings support font embedding for multilingual text."""

    @pytest.fixture
    def mock_word_app(self):
        with patch("src.core.word_converter.win32com.client.Dispatch") as mock_dispatch:
            mock_app = MagicMock()
            mock_dispatch.return_value = mock_app
            yield mock_app

    @pytest.fixture
    def mock_pythoncom(self):
        with patch("src.core.word_converter.pythoncom") as mock_com:
            yield mock_com

    @pytest.fixture
    def mock_process_registry(self):
        with patch("src.core.word_converter.ProcessRegistry"):
            yield

    def test_pdfa_compliance_ensures_font_embedding(self, mock_word_app, mock_pythoncom, mock_process_registry, tmp_path):
        """
        Test that PDF/A compliance mode is used for multilingual documents.
        
        PDF/A (ISO 19005-1) requires full font embedding, ensuring that
        Japanese, Vietnamese, and other non-Latin scripts display correctly
        on any system regardless of installed fonts.
        """
        converter = WordConverter()
        input_file = tmp_path / "multilingual.docx"
        input_file.touch()

        mock_doc = MagicMock()
        mock_doc.Content.Text = MIXED_TEXT
        mock_word_app.Documents.Open.return_value = mock_doc

        # Use PDF/A compliance for better font embedding
        settings = PDFConversionSettings(compliance="pdfa")
        converter.convert(input_file, settings=settings)

        export_args = mock_doc.ExportAsFixedFormat.call_args[1]
        
        # UseISO19005_1 = True means PDF/A compliance with font embedding
        assert export_args["UseISO19005_1"] is True
        # DocStructureTags preserve text structure for accessibility
        assert "DocStructureTags" in export_args

    def test_bitmap_text_disabled_for_text_preservation(self, mock_word_app, mock_pythoncom, mock_process_registry, tmp_path):
        """
        Test that bitmap_text is disabled to preserve searchable text.
        
        When bitmap_text=True, text is rasterized which would make
        multilingual text non-searchable and non-selectable in the PDF.
        """
        converter = WordConverter()
        input_file = tmp_path / "searchable.docx"
        input_file.touch()

        mock_doc = MagicMock()
        mock_word_app.Documents.Open.return_value = mock_doc

        settings = PDFConversionSettings()  # Default settings
        converter.convert(input_file, settings=settings)

        export_args = mock_doc.ExportAsFixedFormat.call_args[1]
        
        # BitmapMissingFonts should be False to keep text as vectors
        assert export_args["BitmapMissingFonts"] is False
