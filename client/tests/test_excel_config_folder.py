import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from src.config import get_excel_sheet_settings, PDFConversionSettings, ExcelSettings

# Complex mock config for Excel testing
MOCK_EXCEL_CONFIG = {
    "pdf_settings": {
        "excel": [
            # 1. Default Rule (Low Priority)
            {
                "sheet_name": "*",
                "priority": 10,
                "settings": {
                    "excel": {"orientation": "landscape", "row_dimensions": None}
                }
            },
            # 2. Specific Sheet Rule (Medium Priority)
            {
                "sheet_name": "*Summary*",
                "priority": 50,
                "settings": {
                    "excel": {"row_dimensions": 0} # Fit to page
                }
            },
            # 3. Folder Rule (High Priority)
            {
                "pattern": "**/CONFIDENTIAL/**",
                "sheet_name": "*", # Explicit wildcard for sheets
                "priority": 100,
                "settings": {
                    "excel": {"orientation": "portrait", "metadata_header": False}
                }
            },
            # 4. Specific Sheet in Folder (Highest Priority)
            {
                "pattern": "**/CONFIDENTIAL/**",
                "sheet_name": "*Summary*",
                "priority": 150,
                "settings": {
                    "excel": {"row_dimensions": 10}
                }
            }
        ]
    }
}

@pytest.fixture
def mock_load_config():
    with patch("src.config.load_config", return_value=MOCK_EXCEL_CONFIG) as mock:
        yield mock

def test_excel_settings_default(mock_load_config):
    """Test default settings for a standard file/sheet."""
    input_path = Path("input/regular.xlsx")
    settings = get_excel_sheet_settings("DataSheet", input_path=input_path)
    
    assert settings.excel.orientation == "landscape"
    assert settings.excel.row_dimensions is None

def test_excel_settings_sheet_match(mock_load_config):
    """Test matching by sheet name only (Prio 50)."""
    input_path = Path("input/regular.xlsx")
    settings = get_excel_sheet_settings("Monthly Summary", input_path=input_path)
    
    # Should inherit landscape from default (merged?) 
    # Logic in get_excel_sheet_settings starts empty/base.
    # Our mock rules:
    # 1. "*" (Prio 10) -> Orientation Landscape
    # 2. "*Summary*" (Prio 50) -> Row Dimensions 0
    # Expected: Orientation Landscape, Row Dims 0
    
    assert settings.excel.orientation == "landscape" # From Prio 10
    assert settings.excel.row_dimensions == 0        # From Prio 50

def test_excel_settings_folder_match(mock_load_config):
    """Test matching by folder (Prio 100)."""
    input_path = Path("input/CONFIDENTIAL/finance.xlsx")
    settings = get_excel_sheet_settings("DataSheet", input_path=input_path)
    
    # 1. "*" (Prio 10) -> Match sheet DataSheet -> Landscape
    # 2. "**/CONFIDENTIAL/**" + "*" (Prio 100) -> Match file + sheet -> Portrait, No Header
    # Expected: Portrait (Override), No Header
    
    assert settings.excel.orientation == "portrait"
    assert settings.excel.metadata_header is False
    assert settings.excel.row_dimensions is None # From Prio 10 (None default in dataclass?)
    # Prio 10 sets row_dimensions=None. Prio 100 doesn't touch it.
    
def test_excel_settings_folder_and_sheet_match(mock_load_config):
    """Test matching by both folder and sheet name (Prio 150)."""
    input_path = Path("input/CONFIDENTIAL/finance.xlsx")
    settings = get_excel_sheet_settings("Executive Summary", input_path=input_path)
    
    # Matches:
    # 1. "*" (Prio 10) -> Landscape
    # 2. "*Summary*" (Prio 50) -> Row Dims 0
    # 3. "**CONF**" (Prio 100) -> Portrait, Header False
    # 4. "**CONF**" + "*Summary*" (Prio 150) -> Row Dims 10, Min Col 1.0
    
    # Merge Sequence:
    # Base: Landscape, Dims None
    # + Prio 50: Dims 0
    # + Prio 100: Portrait, Header False
    # + Prio 150: Dims 10, Min Col 1.0
    
    # Final Expectation:
    # Orientation: Portrait (Prio 100)
    # Header: False (Prio 100)
    # Row Dims: 10 (Prio 150 overrides Prio 50)
    # Min Col: 1.0 (Prio 150)
    
    assert settings.excel.orientation == "portrait"
    assert settings.excel.metadata_header is False
    assert settings.excel.row_dimensions == 10

def test_no_input_path(mock_load_config):
    """Test behavior when input_path is missing (Legacy call)."""
    # Should only match rules where pattern is "*"
    settings = get_excel_sheet_settings("DataSheet")
    
    # Matches Prio 10 ("*" file default implicit??No, config has default pattern "*"?)
    # In config.py logic:
    # file_pattern = rule.get("pattern", "*")
    # if input_path is None: if file_pattern != "*" -> match=False
    
    # Our Mock:
    # 1. default rule: NO "pattern" key -> defaults to "*" -> Matches
    # 3. folder rule: pattern="**/CONFIDENTIAL/**" -> Not "*", so Match=False
    
    assert settings.excel.orientation == "landscape"
    # Should NOT have Prio 100 settings
    assert settings.excel.metadata_header is True # Default 

def test_input_path_mismatch(mock_load_config):
    """Test input path that does NOT match the folder pattern."""
    input_path = Path("input/public/data.xlsx")
    settings = get_excel_sheet_settings("DataSheet", input_path=input_path)
    
    assert settings.excel.orientation == "landscape" # Prio 10
    assert settings.excel.metadata_header is True    # Default
