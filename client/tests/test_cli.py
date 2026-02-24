import pytest
from typer.testing import CliRunner
from unittest.mock import patch, MagicMock
from pathlib import Path
from src.cli import app, get_file_type
from src.version import __version__

runner = CliRunner()


@pytest.fixture(autouse=True)
def mock_console_clear():
    with patch("src.cli.console.clear"):
        yield

@pytest.fixture(autouse=True)
def mock_atexit():
    with patch("src.cli.atexit.register"):
        yield

@pytest.fixture(autouse=True)
def mock_process_registry():
    with patch("src.cli.ProcessRegistry.kill_all"):
        yield

def test_version():

    result = runner.invoke(app, ["--version"])
    assert result.exit_code == 0
    assert f"version: {__version__}" in result.stdout

def test_get_file_type():
    assert get_file_type(Path("test.docx")) == "word"
    assert get_file_type(Path("test.DOC")) == "word"
    assert get_file_type(Path("test.xlsx")) == "excel"
    assert get_file_type(Path("test.ppt")) == "powerpoint"
    assert get_file_type(Path("unknown.txt")) == "word" # Fallback

@patch("src.cli.WordConverter")
@patch("src.cli.get_files")
def test_convert_success_mock(mock_get_files, mock_converter_cls):
    # Setup mocks
    mock_instance = mock_converter_cls.return_value
    mock_get_files.return_value = [Path("test.docx")]
    
    with runner.isolated_filesystem():
        # Create dummy input
        Path("test.docx").touch()
        
        result = runner.invoke(app, ["convert", "test.docx"])
        
        assert result.exit_code == 0
        # assert "Converting" in result.stdout # TUI hides this
        assert "Conversion Completed" in result.stdout
        assert "Success" in result.stdout
        
        # Verify converter called
        mock_instance.convert.assert_called_once()


@patch("src.cli.WordConverter")
def test_convert_directory(mock_converter_cls):
    mock_instance = mock_converter_cls.return_value
    
    with runner.isolated_filesystem():
        # Setup inputs
        input_dir = Path("input")
        input_dir.mkdir()
        (input_dir / "doc1.docx").touch()
        (input_dir / "doc2.doc").touch()
        
        output_dir = Path("output")
        
        result = runner.invoke(app, ["convert", "input", "--output", "output"])
        
        assert result.exit_code == 0
        # Should convert 2 files
        assert mock_instance.convert.call_count == 2

def test_convert_missing_input():
    # We do NOT mock filesystem here to test generic Typer check, 
    # but Typer checks existence before calling logic if argument has `exists=True`.
    # So we expect fail.
    result = runner.invoke(app, ["convert", "non_existent.docx"])
    assert result.exit_code != 0
    # Typer/Click prints validation errors to output/stderr
    assert "does not exist" in result.output or "Invalid value" in result.output

@patch("src.cli.get_pdf_handling_config")
@patch("src.cli.shutil.copy2")
def test_convert_pdf_copy(mock_copy, mock_get_config):
    # Setup mock config
    mock_config = MagicMock()
    mock_config.copy_to_output = True
    mock_get_config.return_value = mock_config

    with runner.isolated_filesystem():
        # Setup inputs
        input_dir = Path("input")
        input_dir.mkdir()
        pdf_file = input_dir / "doc.pdf"
        pdf_file.touch()
        
        output_dir = Path("output")
        
        # Test
        result = runner.invoke(app, ["convert", "input", "--output", "output"])
        
        assert result.exit_code == 0
        assert "Conversion Completed" in result.stdout
        # assert "doc.pdf" in result.stdout # In TUI logs
        
        # Verify copy called
        mock_copy.assert_called()

        
@patch("src.cli.get_pdf_handling_config")
@patch("src.cli.shutil.copy2")
def test_convert_pdf_no_copy(mock_copy, mock_get_config):
    # Setup mock config
    mock_config = MagicMock()
    mock_config.copy_to_output = False
    mock_get_config.return_value = mock_config

    with runner.isolated_filesystem():
        # Setup inputs
        input_dir = Path("input")
        input_dir.mkdir()
        pdf_file = input_dir / "doc.pdf"
        pdf_file.touch()
        
        output_dir = Path("output")
        
        # Test
        result = runner.invoke(app, ["convert", "input", "--output", "output"])
        
        assert result.exit_code == 0
        
        # Verify copy NOT called
        mock_copy.assert_not_called()
        # Should be counted as success but logged
        assert "Success" in result.stdout


