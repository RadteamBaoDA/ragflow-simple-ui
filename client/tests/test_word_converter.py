import pytest
from unittest.mock import MagicMock, patch, call
from pathlib import Path
from src.core.word_converter import WordConverter
from src.config import PDFConversionSettings, LayoutSettings

@pytest.fixture
def mock_word_app():
    with patch("src.core.word_converter.win32com.client.Dispatch") as mock_dispatch:
        mock_app = MagicMock()
        mock_dispatch.return_value = mock_app
        yield mock_app

@pytest.fixture
def mock_pythoncom():
    with patch("src.core.word_converter.pythoncom") as mock_com:
        yield mock_com

@pytest.fixture
def mock_process_registry():
    with patch("src.core.word_converter.ProcessRegistry"):
        yield

@pytest.fixture
def converter(mock_word_app, mock_pythoncom, mock_process_registry):
    return WordConverter()

def test_convert_success(converter, mock_word_app, tmp_path):
    # Setup paths
    input_file = tmp_path / "test.docx"
    input_file.touch()
    output_file = tmp_path / "test.pdf"
    
    # Setup mock document
    mock_doc = MagicMock()
    mock_word_app.Documents.Open.return_value = mock_doc
    
    # Run conversion
    settings = PDFConversionSettings()
    result = converter.convert(input_file, output_file, settings)
    
    # Verify Open called with correct file path (other params suppress dialogs)
    mock_word_app.Documents.Open.assert_called_once()
    call_args = mock_word_app.Documents.Open.call_args
    assert call_args[0][0] == str(input_file.resolve())
    # Verify key dialog suppression parameters
    assert call_args[1].get('ConfirmConversions') == False
    assert call_args[1].get('ReadOnly') == True
    
    # Verify Export called
    assert mock_doc.ExportAsFixedFormat.call_count == 1
    args = mock_doc.ExportAsFixedFormat.call_args[1]
    assert args["OutputFileName"] == str(output_file.resolve())
    assert args["ExportFormat"] == 17 # wdExportFormatPDF
    
    # Verify Cleanup
    mock_doc.Close.assert_called_once()
    mock_word_app.Quit.assert_called_once()  # Quit called in context manager exit

def test_convert_with_layout_settings(converter, mock_word_app, tmp_path):
    input_file = tmp_path / "test.docx"
    input_file.touch()
    
    mock_doc = MagicMock()
    mock_word_app.Documents.Open.return_value = mock_doc
    
    settings = PDFConversionSettings(
        layout=LayoutSettings(orientation="landscape", margins="narrow")
    )
    
    converter.convert(input_file, None, settings)
    
    # Verify PageSetup calls
    # landscape = 1
    assert mock_doc.PageSetup.Orientation == 1
    # narrow = 36 points (roughly 0.5 inch?) Implementation says 36.
    assert mock_doc.PageSetup.LeftMargin == 36

def test_convert_failure_handling(converter, mock_word_app, tmp_path):
    input_file = tmp_path / "test.docx"
    input_file.touch()
    
    # Make Open raise exception
    mock_word_app.Documents.Open.side_effect = Exception("Word Error")
    
    with pytest.raises(Exception, match="Word Error"):
        converter.convert(input_file)
        
    # Ensure Quit is still called (safety cleanup)
    mock_word_app.Quit.assert_called_once()
