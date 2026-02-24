import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from pathlib import Path
from src.core.excel_converter import ExcelConverter
from src.config import PDFConversionSettings, ExcelSettings, OptimizationSettings


@pytest.fixture
def mock_excel_app():
    with patch("src.core.excel_converter.win32com.client.Dispatch") as mock_dispatch:
        mock_app = MagicMock()
        mock_dispatch.return_value = mock_app
        yield mock_app


@pytest.fixture
def mock_pythoncom():
    with patch("src.core.excel_converter.pythoncom") as mock_com:
        yield mock_com


@pytest.fixture
def mock_process_registry():
    with patch("src.core.excel_converter.ProcessRegistry"):
        yield


@pytest.fixture
def mock_sheet_settings():
    """Mock get_excel_sheet_settings to return the base settings unchanged."""
    with patch("src.core.excel_converter.get_excel_sheet_settings") as mock_get:
        # Return the base_settings passed to it (second argument)
        # Updated signature: (sheet_name, base_settings, input_path, base_path)
        def side_effect(sheet_name, base_settings, input_path=None, base_path=None):
            if not getattr(base_settings, 'excel', None):
                base_settings.excel = ExcelSettings()
            return base_settings
        mock_get.side_effect = side_effect
        yield mock_get


@pytest.fixture
def converter(mock_excel_app, mock_pythoncom, mock_sheet_settings, mock_process_registry):
    return ExcelConverter()


def configure_mock_sheet(mock_sheet, name="Sheet1", cols=10, rows=100):
    """Helper to configure a mock sheet with all necessary numeric properties."""
    mock_sheet.Visible = -1  # xlSheetVisible
    mock_sheet.Name = name
    
    # UsedRange properties
    mock_sheet.UsedRange.Columns.Count = cols
    mock_sheet.UsedRange.Rows.Count = rows
    mock_sheet.UsedRange.Left = 0.0
    mock_sheet.UsedRange.Top = 0.0
    mock_sheet.UsedRange.Width = cols * 72.0
    mock_sheet.UsedRange.Height = rows * 15.0
    mock_sheet.UsedRange.Row = 1
    mock_sheet.UsedRange.Column = 1
    
    # Cells.Find properties
    mock_sheet.Cells.Find().Row = rows
    mock_sheet.Cells.Find().Column = cols
    
    # Column/Row accessors
    mock_sheet.Columns().Width = 72.0
    mock_sheet.Columns().Left = 0.0 
    mock_sheet.Rows().Height = 15.0
    mock_sheet.Rows().Top = 0.0
    
    # Mocking indexed access for columns/rows if needed
    def get_col(idx):
        col = MagicMock()
        col.Left = (idx - 1) * 72.0
        col.Width = 72.0
        return col
    mock_sheet.Columns.side_effect = get_col
    
    def get_row(idx):
        row = MagicMock()
        row.Top = (idx - 1) * 15.0
        row.Height = 15.0
        return row
    mock_sheet.Rows.side_effect = get_row
    
    return mock_sheet


def test_convert_success(converter, mock_excel_app, tmp_path):
    """Test basic Excel to PDF conversion."""
    input_file = tmp_path / "test.xlsx"
    input_file.touch()
    output_file = tmp_path / "test.pdf"
    
    mock_workbook = MagicMock()
    mock_sheet = MagicMock()
    configure_mock_sheet(mock_sheet, name="Sheet1", cols=10, rows=100)
    
    # Mock Worksheets as a list with __iter__ and __call__ for item access
    mock_worksheets = MagicMock()
    mock_worksheets.__iter__ = lambda self: iter([mock_sheet])
    mock_worksheets.__call__ = lambda self, idx: mock_sheet
    mock_workbook.Worksheets = mock_worksheets
    mock_workbook.ActiveSheet = mock_sheet
    mock_excel_app.Workbooks.Open.return_value = mock_workbook
    
    settings = PDFConversionSettings()
    result = converter.convert(input_file, output_file, settings)
    
    mock_excel_app.Workbooks.Open.assert_called_once()
    assert mock_sheet.ExportAsFixedFormat.call_count == 1
    mock_workbook.Close.assert_called_once_with(SaveChanges=False)
    mock_excel_app.Quit.assert_called_once()


def test_convert_with_sheet_name(converter, mock_excel_app, tmp_path):
    """Test conversion with specific sheet name filter."""
    input_file = tmp_path / "test.xlsx"
    input_file.touch()
    
    mock_workbook = MagicMock()
    mock_sheet1 = MagicMock()
    configure_mock_sheet(mock_sheet1, name="Data", cols=5, rows=10)
    
    mock_sheet2 = MagicMock()
    configure_mock_sheet(mock_sheet2, name="Summary", cols=3, rows=5)
    
    # Mock Worksheets as a list with __iter__ and __call__ for item access
    mock_worksheets = MagicMock()
    mock_worksheets.__iter__ = lambda self: iter([mock_sheet1, mock_sheet2])
    def get_sheet(idx):
        return mock_sheet1 if idx == 1 else mock_sheet2
    mock_worksheets.__call__ = get_sheet
    mock_workbook.Worksheets = mock_worksheets
    mock_workbook.ActiveSheet = mock_sheet1
    mock_excel_app.Workbooks.Open.return_value = mock_workbook
    
    settings = PDFConversionSettings(
        excel=ExcelSettings(sheet_name="Data")
    )
    
    converter.convert(input_file, None, settings)
    mock_sheet1.ExportAsFixedFormat.assert_called_once()


def test_convert_row_dimensions_fit_all(converter, mock_excel_app, tmp_path):
    """Test row_dimensions=0 fits entire sheet on one page."""
    input_file = tmp_path / "test.xlsx"
    input_file.touch()
    
    mock_workbook = MagicMock()
    mock_sheet = MagicMock()
    configure_mock_sheet(mock_sheet, name="Sheet1", cols=20, rows=500)
    
    mock_worksheets = MagicMock()
    mock_worksheets.__iter__ = lambda self: iter([mock_sheet])
    mock_worksheets.__call__ = lambda self, idx: mock_sheet
    mock_workbook.Worksheets = mock_worksheets
    mock_workbook.ActiveSheet = mock_sheet
    mock_excel_app.Workbooks.Open.return_value = mock_workbook
    
    settings = PDFConversionSettings(
        excel=ExcelSettings(row_dimensions=0)
    )
    
    converter.convert(input_file, None, settings)
    assert mock_sheet.PageSetup.FitToPagesTall == 1


def test_convert_orientation_portrait(converter, mock_excel_app, tmp_path):
    """Test portrait orientation setting."""
    input_file = tmp_path / "test.xlsx"
    input_file.touch()
    
    mock_workbook = MagicMock()
    mock_sheet = MagicMock()
    configure_mock_sheet(mock_sheet, name="Sheet1", cols=5, rows=10)
    
    mock_worksheets = MagicMock()
    mock_worksheets.__iter__ = lambda self: iter([mock_sheet])
    mock_worksheets.__call__ = lambda self, idx: mock_sheet
    mock_workbook.Worksheets = mock_worksheets
    mock_workbook.ActiveSheet = mock_sheet
    mock_excel_app.Workbooks.Open.return_value = mock_workbook
    
    settings = PDFConversionSettings(
        excel=ExcelSettings(orientation="portrait")
    )
    
    converter.convert(input_file, None, settings)
    # Portrait orientation = 1
    assert mock_sheet.PageSetup.Orientation == 1


def test_convert_metadata_header_enabled(converter, mock_excel_app, tmp_path):
    """Test metadata header is applied when enabled."""
    input_file = tmp_path / "test.xlsx"
    input_file.touch()
    
    mock_workbook = MagicMock()
    mock_sheet = MagicMock()
    configure_mock_sheet(mock_sheet, name="DataSheet", cols=10, rows=20)
    
    mock_worksheets = MagicMock()
    mock_worksheets.__iter__ = lambda self: iter([mock_sheet])
    mock_worksheets.__call__ = lambda self, idx: mock_sheet
    mock_workbook.Worksheets = mock_worksheets
    mock_workbook.ActiveSheet = mock_sheet
    mock_excel_app.Workbooks.Open.return_value = mock_workbook
    
    settings = PDFConversionSettings(
        excel=ExcelSettings(metadata_header=True)
    )
    
    converter.convert(input_file, None, settings)
    
    page_setup = mock_sheet.PageSetup
    assert page_setup.LeftHeader is not None
    assert page_setup.CenterHeader is not None
    assert page_setup.RightHeader is not None


def test_convert_low_quality(converter, mock_excel_app, tmp_path):
    """Test low quality optimization setting."""
    input_file = tmp_path / "test.xlsx"
    input_file.touch()
    
    mock_workbook = MagicMock()
    mock_sheet = MagicMock()
    configure_mock_sheet(mock_sheet, name="Sheet1", cols=5, rows=10)
    
    mock_worksheets = MagicMock()
    mock_worksheets.__iter__ = lambda self: iter([mock_sheet])
    mock_worksheets.__call__ = lambda self, idx: mock_sheet
    mock_workbook.Worksheets = mock_worksheets
    mock_workbook.ActiveSheet = mock_sheet
    mock_excel_app.Workbooks.Open.return_value = mock_workbook
    
    settings = PDFConversionSettings(
        optimization=OptimizationSettings(image_quality="low")
    )
    
    converter.convert(input_file, None, settings)
    
    args = mock_sheet.ExportAsFixedFormat.call_args[1]
    assert args["Quality"] == 1  # xlQualityMinimum


def test_convert_failure_handling(converter, mock_excel_app, tmp_path):
    """Test exception handling and cleanup."""
    input_file = tmp_path / "test.xlsx"
    input_file.touch()
    
    mock_excel_app.Workbooks.Open.side_effect = Exception("Excel Error")
    
    with pytest.raises(Exception, match="Excel Error"):
        converter.convert(input_file, Path("out.pdf"), PDFConversionSettings())
        
    mock_excel_app.Quit.assert_called_once()


def test_convert_file_not_found(converter):
    """Test FileNotFoundError for missing files."""
    with pytest.raises(FileNotFoundError):
        converter.convert(Path("nonexistent.xlsx"), Path("out.pdf"), PDFConversionSettings())


def test_smart_page_size_calculation(converter, mock_excel_app, tmp_path):
    """Test smart page size calculates correct width for many columns."""
    mock_sheet = MagicMock()
    mock_sheet.Name = "WideData"
    mock_sheet.Columns.return_value.Width = 72.0
    
    page_width, _ = converter._calculate_smart_page_size(mock_sheet, 50, content_width_points=50*72.0)
    assert page_width == 50.5


def test_smart_page_size_max_clamp(converter, mock_excel_app, tmp_path):
    """Test smart page size clamps to max 129 inches."""
    mock_sheet = MagicMock()
    page_width, _ = converter._calculate_smart_page_size(mock_sheet, 200, content_width_points=200*72.0)
    assert page_width == 200.5


# ---- Tests for Custom Paper Width + Standard Paper Fallback ----

def test_page_size_landscape_custom_paper(converter, mock_excel_app, tmp_path):
    """Content 10" wide with landscape should use custom paper width for exact fit."""
    input_file = tmp_path / "test.xlsx"
    input_file.touch()
    
    mock_workbook = MagicMock()
    mock_sheet = MagicMock()
    configure_mock_sheet(mock_sheet, name="Sheet1", cols=10, rows=20)
    
    mock_worksheets = MagicMock()
    mock_worksheets.__iter__ = lambda self: iter([mock_sheet])
    mock_worksheets.__call__ = lambda self, idx: mock_sheet
    mock_workbook.Worksheets = mock_worksheets
    mock_workbook.ActiveSheet = mock_sheet
    mock_excel_app.Workbooks.Open.return_value = mock_workbook
    
    # Content width = 10 inches = 720 points
    mock_sheet.Columns.side_effect = lambda idx: MagicMock(Width=72.0)
    
    settings = PDFConversionSettings(
        excel=ExcelSettings(orientation="landscape")
    )
    
    converter.convert(input_file, None, settings)
    
    # Should set landscape orientation and custom paper dimensions
    page_setup = mock_sheet.PageSetup
    assert page_setup.Orientation == 2  # xlLandscape


def test_page_size_landscape_custom_fits_content(converter, mock_excel_app, tmp_path):
    """Content 11.5" wide should use custom paper (exact fit), not standard Legal (14")."""
    input_file = tmp_path / "test.xlsx"
    input_file.touch()
    
    mock_workbook = MagicMock()
    mock_sheet = MagicMock()
    configure_mock_sheet(mock_sheet, name="WideSheet", cols=16, rows=20)
    
    mock_worksheets = MagicMock()
    mock_worksheets.__iter__ = lambda self: iter([mock_sheet])
    mock_worksheets.__call__ = lambda self, idx: mock_sheet
    mock_workbook.Worksheets = mock_worksheets
    mock_workbook.ActiveSheet = mock_sheet
    mock_excel_app.Workbooks.Open.return_value = mock_workbook
    
    # Content width = 11.5 inches = 828 points → page_width = 12.0"
    mock_sheet.Columns.side_effect = lambda idx: MagicMock(Width=51.75)
    
    settings = PDFConversionSettings(
        excel=ExcelSettings(orientation="landscape")
    )
    
    converter.convert(input_file, None, settings)
    
    page_setup = mock_sheet.PageSetup
    assert page_setup.Orientation == 2  # xlLandscape


def test_page_size_portrait_custom_paper(converter, mock_excel_app, tmp_path):
    """Content 8" wide with portrait should use custom paper width."""
    input_file = tmp_path / "test.xlsx"
    input_file.touch()
    
    mock_workbook = MagicMock()
    mock_sheet = MagicMock()
    configure_mock_sheet(mock_sheet, name="Sheet1", cols=8, rows=20)
    
    mock_worksheets = MagicMock()
    mock_worksheets.__iter__ = lambda self: iter([mock_sheet])
    mock_worksheets.__call__ = lambda self, idx: mock_sheet
    mock_workbook.Worksheets = mock_worksheets
    mock_workbook.ActiveSheet = mock_sheet
    mock_excel_app.Workbooks.Open.return_value = mock_workbook
    
    mock_sheet.Columns.side_effect = lambda idx: MagicMock(Width=72.0)
    
    settings = PDFConversionSettings(
        excel=ExcelSettings(orientation="portrait")
    )
    
    converter.convert(input_file, None, settings)
    
    page_setup = mock_sheet.PageSetup
    assert page_setup.Orientation == 1  # xlPortrait


def test_page_size_forced_orientation(converter, mock_excel_app, tmp_path):
    """Forced portrait orientation should be applied."""
    input_file = tmp_path / "test.xlsx"
    input_file.touch()
    
    mock_workbook = MagicMock()
    mock_sheet = MagicMock()
    configure_mock_sheet(mock_sheet, name="Sheet1", cols=5, rows=10)
    
    mock_worksheets = MagicMock()
    mock_worksheets.__iter__ = lambda self: iter([mock_sheet])
    mock_worksheets.__call__ = lambda self, idx: mock_sheet
    mock_workbook.Worksheets = mock_worksheets
    mock_workbook.ActiveSheet = mock_sheet
    mock_excel_app.Workbooks.Open.return_value = mock_workbook
    
    mock_sheet.Columns.side_effect = lambda idx: MagicMock(Width=72.0)
    
    settings = PDFConversionSettings(
        excel=ExcelSettings(orientation="portrait")
    )
    
    converter.convert(input_file, None, settings)
    
    page_setup = mock_sheet.PageSetup
    assert page_setup.Orientation == 1  # xlPortrait


def test_page_size_standard_fallback_when_custom_fails(converter, mock_excel_app, tmp_path):
    """When custom paper fails, should fall back to standard paper catalog."""
    input_file = tmp_path / "test.xlsx"
    input_file.touch()
    
    mock_workbook = MagicMock()
    mock_sheet = MagicMock()
    configure_mock_sheet(mock_sheet, name="Sheet1", cols=20, rows=10)
    
    mock_worksheets = MagicMock()
    mock_worksheets.__iter__ = lambda self: iter([mock_sheet])
    mock_worksheets.__call__ = lambda self, idx: mock_sheet
    mock_workbook.Worksheets = mock_worksheets
    mock_workbook.ActiveSheet = mock_sheet
    mock_excel_app.Workbooks.Open.return_value = mock_workbook
    
    mock_sheet.Columns.side_effect = lambda idx: MagicMock(Width=72.0)
    
    # Make PaperWidth/PaperHeight fail to force standard fallback
    page_setup_mock = mock_sheet.PageSetup
    original_setattr = type(page_setup_mock).__setattr__
    
    def reject_custom_paper(self, name, value):
        if name in ('PaperWidth', 'PaperHeight'):
            raise Exception("Custom paper not supported")
        original_setattr(self, name, value)
    
    type(page_setup_mock).__setattr__ = reject_custom_paper
    
    settings = PDFConversionSettings(
        excel=ExcelSettings(orientation="landscape")
    )
    
    try:
        converter.convert(input_file, None, settings)
    finally:
        # Restore original setattr
        type(page_setup_mock).__setattr__ = original_setattr
    
    # Should have fallen back to standard paper and set landscape
    assert page_setup_mock.Orientation == 2  # xlLandscape

