import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from src.config import (
    get_pdf_settings, 
    _merge_dict, 
    PDFConversionSettings, 
    LayoutSettings, 
    MetadataSettings,
    PdfHandlingSettings,
    get_pdf_handling_config
)


# Mock config data
MOCK_CONFIG = {
    "pdf_settings": {
        "word": [
            {
                "pattern": "*",
                "priority": 10,
                "settings": {
                    "scope": "all",
                    "layout": {"orientation": "portrait"},
                    "compliance": "pdfa"
                }
            },
            {
                "pattern": "**/CONFIDENTIAL/**",
                "priority": 100,
                "settings": {
                    "metadata": {"include_properties": False}
                }
            }
        ],
        "excel": [
            {
                "pattern": "*",
                "priority": 10,
                "settings": {
                    "layout": {"orientation": "landscape"}
                }
            }
        ]
    }
}

@pytest.fixture
def mock_load_config():
    with patch("src.config.load_config", return_value=MOCK_CONFIG) as mock:
        yield mock

def test_merge_dict():
    base = {"a": 1, "b": {"x": 10, "y": 20}}
    update = {"a": 2, "b": {"x": 30}, "c": 3}
    
    result = _merge_dict(base, update)
    
    assert result["a"] == 2
    assert result["b"]["x"] == 30
    assert result["b"]["y"] == 20
    assert result["c"] == 3
    # Base should not be mutated
    assert base["a"] == 1

def test_get_pdf_settings_default_word(mock_load_config):
    # Test getting defaults for a standard file
    settings = get_pdf_settings(input_path=Path("input/doc.docx"), file_type="word")
    
    assert settings.scope == "all"
    assert settings.layout.orientation == "portrait"
    assert settings.compliance == "pdfa"
    # Metadata should follow class defaults if not specified, 
    # but here defaults are True in dataclass.
    assert settings.metadata.include_properties is True

def test_get_pdf_settings_pattern_override(mock_load_config):
    # Test override logic
    settings = get_pdf_settings(input_path=Path("input/CONFIDENTIAL/secret.docx"), file_type="word")
    
    # Base settings should be present
    assert settings.scope == "all"
    assert settings.layout.orientation == "portrait"
    # Override should be applied
    assert settings.metadata.include_properties is False

def test_get_pdf_settings_excel(mock_load_config):
    settings = get_pdf_settings(input_path=Path("sheet.xlsx"), file_type="excel")
    assert settings.layout.orientation == "landscape"

def test_get_pdf_settings_no_match(mock_load_config):
    # If no pattern matches (which is hard with "*"), but let's assume empty config logic
    pass 

def test_priority_sorting(mock_load_config):
    # Create a complex scenario with 3 priorities
    complex_config = {
        "pdf_settings": {
            "word": [
                {"pattern": "*", "priority": 10, "settings": {"bookmarks": "none"}},
                {"pattern": "*important*", "priority": 50, "settings": {"bookmarks": "headings"}},
                {"pattern": "**/CLIENT/**", "priority": 100, "settings": {"bookmarks": "bookmarks"}}
            ]
        }
    }
    
    with patch("src.config.load_config", return_value=complex_config):
        # Case 1: Just *
        s1 = get_pdf_settings(Path("doc.docx"), "word")
        assert s1.bookmarks == "none"
        
        # Case 2: * + *important*
        s2 = get_pdf_settings(Path("very_important_doc.docx"), "word")
        assert s2.bookmarks == "headings"
        
        # Case 3: * + *important* + **/CLIENT/** (Highest priority wins)
        s3 = get_pdf_settings(Path("input/CLIENT/very_important_doc.docx"), "word")
        assert s3.bookmarks == "bookmarks"

def test_get_pdf_handling_config(mock_load_config):
    # Test loading PDF handling config
    with patch("src.config.load_config", return_value={"pdf_handling": {"copy_to_output": True}}):
        config = get_pdf_handling_config()
        assert config.copy_to_output is True

    # Test default
    with patch("src.config.load_config", return_value={}):
        config = get_pdf_handling_config()
        assert config.copy_to_output is False

