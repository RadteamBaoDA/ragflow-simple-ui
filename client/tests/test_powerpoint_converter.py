import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path
from src.core.powerpoint_converter import PowerPointConverter
from src.config import PDFConversionSettings, PowerPointSettings, OptimizationSettings


@pytest.fixture
def mock_ppt_app():
    with patch("src.core.powerpoint_converter.win32com.client.Dispatch") as mock_dispatch:
        mock_app = MagicMock()
        mock_dispatch.return_value = mock_app
        yield mock_app


@pytest.fixture
def mock_pythoncom():
    with patch("src.core.powerpoint_converter.pythoncom") as mock_com:
        yield mock_com


@pytest.fixture
def mock_process_registry():
    with patch("src.core.powerpoint_converter.ProcessRegistry"):
        yield


@pytest.fixture
def converter(mock_ppt_app, mock_pythoncom, mock_process_registry):
    return PowerPointConverter()


def test_convert_success(converter, mock_ppt_app, tmp_path):
    # Setup paths
    input_file = tmp_path / "test.pptx"
    input_file.touch()
    output_file = tmp_path / "test.pdf"
    
    # Setup mock presentation
    mock_presentation = MagicMock()
    mock_ppt_app.Presentations.Open.return_value = mock_presentation
    
    # Run conversion
    settings = PDFConversionSettings()
    result = converter.convert(input_file, output_file, settings)
    
    # Verify Open called with correct file path (other params suppress dialogs)
    mock_ppt_app.Presentations.Open.assert_called_once()
    call_args = mock_ppt_app.Presentations.Open.call_args
    assert call_args[0][0] == str(input_file.resolve())
    # Verify key dialog suppression parameters
    assert call_args[1].get('ReadOnly') == True
    assert call_args[1].get('OpenConflictDocument') == False
    
    # Verify Export called
    assert mock_presentation.ExportAsFixedFormat.call_count == 1
    args = mock_presentation.ExportAsFixedFormat.call_args[1]
    assert args["Path"] == str(output_file.resolve())
    assert args["FixedFormatType"] == 2  # ppFixedFormatTypePDF
    
    # Verify Cleanup
    mock_presentation.Close.assert_called_once()
    mock_ppt_app.Quit.assert_called_once()


def test_convert_color_mode_grayscale(converter, mock_ppt_app, tmp_path):
    input_file = tmp_path / "test.pptx"
    input_file.touch()
    
    mock_presentation = MagicMock()
    mock_ppt_app.Presentations.Open.return_value = mock_presentation
    
    settings = PDFConversionSettings(
        powerpoint=PowerPointSettings(color_mode="grayscale")
    )
    
    converter.convert(input_file, None, settings)
    
    # Verify export was called (color mode is internal to export args)
    assert mock_presentation.ExportAsFixedFormat.call_count == 1


def test_convert_color_mode_bw(converter, mock_ppt_app, tmp_path):
    input_file = tmp_path / "test.pptx"
    input_file.touch()
    
    mock_presentation = MagicMock()
    mock_ppt_app.Presentations.Open.return_value = mock_presentation
    
    settings = PDFConversionSettings(
        powerpoint=PowerPointSettings(color_mode="bw")
    )
    
    converter.convert(input_file, None, settings)
    assert mock_presentation.ExportAsFixedFormat.call_count == 1


def test_convert_slide_range(converter, mock_ppt_app, tmp_path):
    input_file = tmp_path / "test.pptx"
    input_file.touch()
    
    mock_presentation = MagicMock()
    mock_ppt_app.Presentations.Open.return_value = mock_presentation
    
    settings = PDFConversionSettings(
        scope="range",
        powerpoint=PowerPointSettings(slide_from=2, slide_to=5)
    )
    
    converter.convert(input_file, None, settings)
    
    args = mock_presentation.ExportAsFixedFormat.call_args[1]
    assert args["RangeType"] == 4  # ppPrintSlideRange


def test_convert_pdfa_compliance(converter, mock_ppt_app, tmp_path):
    input_file = tmp_path / "test.pptx"
    input_file.touch()
    
    mock_presentation = MagicMock()
    mock_ppt_app.Presentations.Open.return_value = mock_presentation
    
    settings = PDFConversionSettings(compliance="pdfa")
    
    converter.convert(input_file, None, settings)
    
    args = mock_presentation.ExportAsFixedFormat.call_args[1]
    assert args["UseISO19005_1"] is True


def test_convert_standard_compliance(converter, mock_ppt_app, tmp_path):
    input_file = tmp_path / "test.pptx"
    input_file.touch()
    
    mock_presentation = MagicMock()
    mock_ppt_app.Presentations.Open.return_value = mock_presentation
    
    settings = PDFConversionSettings(compliance="standard")
    
    converter.convert(input_file, None, settings)
    
    args = mock_presentation.ExportAsFixedFormat.call_args[1]
    assert args["UseISO19005_1"] is False


def test_convert_low_quality(converter, mock_ppt_app, tmp_path):
    input_file = tmp_path / "test.pptx"
    input_file.touch()
    
    mock_presentation = MagicMock()
    mock_ppt_app.Presentations.Open.return_value = mock_presentation
    
    settings = PDFConversionSettings(
        optimization=OptimizationSettings(image_quality="low")
    )
    
    converter.convert(input_file, None, settings)
    
    args = mock_presentation.ExportAsFixedFormat.call_args[1]
    # ppFixedFormatIntentScreen = 1 for low quality
    assert args["Intent"] == 1


def test_convert_failure_handling(converter, mock_ppt_app, tmp_path):
    input_file = tmp_path / "test.pptx"
    input_file.touch()
    
    # Make Open raise exception
    mock_ppt_app.Presentations.Open.side_effect = Exception("PowerPoint Error")
    
    with pytest.raises(Exception, match="PowerPoint Error"):
        converter.convert(input_file)
        
    # Ensure Quit is still called (safety cleanup)
    mock_ppt_app.Quit.assert_called_once()


def test_convert_file_not_found(converter):
    with pytest.raises(FileNotFoundError):
        converter.convert(Path("nonexistent.pptx"))
