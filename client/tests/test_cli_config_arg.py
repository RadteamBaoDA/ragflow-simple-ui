
import pytest
from typer.testing import CliRunner
from unittest.mock import patch, MagicMock
from pathlib import Path
from src.cli import app
import yaml
import shutil
import os

runner = CliRunner()

@pytest.fixture(autouse=True)
def mock_console_clear():
    with patch("src.cli.console.clear"):
        yield

from src import config

@pytest.fixture(autouse=True)
def reset_config_path():
    # Setup: Reset to default
    config.set_config_path(Path("config.yml"))
    yield
    # Teardown: Reset to default
    config.set_config_path(Path("config.yml"))

@patch("src.cli.WordConverter")
@patch("src.cli.ProcessRegistry.kill_all")
def test_cli_config_arg_success(mock_kill_all, mock_converter_cls):
    """
    Test that --config parameter is accepted and logged.
    """
    # Setup mock converter
    mock_instance = mock_converter_cls.return_value
    mock_instance.convert.return_value = None

    with runner.isolated_filesystem():
        # Create a custom config file
        config_data = {
            "logging": {"level": "DEBUG"},
            "pdf_settings": {"word": []}
        }
        config_path = Path("custom_config.yml")
        with open(config_path, "w") as f:
            yaml.dump(config_data, f)
            
        # Create a dummy input file
        input_file = Path("test_doc.docx")
        input_file.touch()
        
        # Invoke CLI with --config
        result = runner.invoke(app, ["convert", str(input_file), "--config", str(config_path)])
        
        # Verify execution success
        assert result.exit_code == 0, f"Exit code: {result.exit_code}, Output: {result.output}"
        
        # Verify that the config path log message is present
        expected_log_part = f"Using configuration file:"
        if expected_log_part not in result.output:
            print(f"\n[DEBUG] Captured Output:\n{result.output}")
            
        assert expected_log_part in result.output
        assert str(config_path.name) in result.output

@patch("src.cli.WordConverter")
@patch("src.cli.ProcessRegistry.kill_all")
def test_cli_default_config(mock_kill_all, mock_converter_cls):
    """
    Test that if no --config is passed, it defaults to config.yml in CWD.
    """
    # Setup mock converter
    mock_instance = mock_converter_cls.return_value
    mock_instance.convert.return_value = None

    with runner.isolated_filesystem():
        # Create default config file in current directory
        config_data = {
            "logging": {"level": "INFO"},
            "pdf_settings": {"word": []}
        }
        default_config = Path("config.yml")
        with open(default_config, "w") as f:
            yaml.dump(config_data, f)
            
        # Create a dummy input file
        input_file = Path("test_doc.docx")
        input_file.touch()
        
        # Invoke CLI WITHOUT --config
        result = runner.invoke(app, ["convert", str(input_file)])
        
        # Verify execution success
        assert result.exit_code == 0, f"Exit code: {result.exit_code}, Output: {result.output}"
        
        # Verify logging shows we used the default config.yml
        expected_path = default_config.resolve()
        
        if "Using configuration file" not in result.output:
             print(f"\n[DEBUG] Captured Output:\n{result.output}")

        assert "Using configuration file" in result.output
        assert str(expected_path.name) in result.output
