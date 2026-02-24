import sys
import os
from unittest.mock import MagicMock, PropertyMock

# Add project root to path
sys.path.append(os.path.abspath("."))

from src.core.excel_converter import ExcelConverter
from src.config import ExcelSettings

def test_fallback_logic():
    converter = ExcelConverter()
    settings = ExcelSettings()
    settings.orientation = "auto"
    
    print("\n--- Testing Page Size Fallback Logic ---\n")

    # Mock Worksheet
    sheet = MagicMock()
    sheet.Name = "TestSheet"
    page_setup = MagicMock()
    sheet.PageSetup = page_setup
    
    # Test Scenario: 
    # Content width = 10 inches.
    # Should fit in "Letter" (11.0 landscape) or "Legal" (14.0 landscape).
    # We will simulate "Letter" failing, and "Legal" succeeding.
    
    # 1. Content width setup
    sheet.Range.return_value.Width = 10 * 72 # 10 inches
    
    # 2. Mock PaperSize property setter to fail for Letter (Enum 1) and succeed for Legal (Enum 5)
    # This is tricky with PropertyMock. We can use a side_effect on the setting.
    
    # Constants from code
    xlPaperLetter = 1
    xlPaperLegal = 5
    
    def paper_size_setter(value):
        if value == xlPaperLetter:
            print(f"  -> Attempting to set PaperSize to Letter ({value})... REJECTING")
            raise Exception("Printer does not support Letter")
        print(f"  -> Attempting to set PaperSize to {value}... ACCEPTING")
        # Store it to verify readback
        page_setup._paper_size = value

    # We need to hook into the property setting.
    # MagicMock doesn't support property setters nicely with side_effect unless we configure the type?
    # Easier way: The code does `page_setup.PaperSize = enum`.
    # We can use a class based mock or just trust the logic if we can mock the assignment.
    
    # Actually, Python's MagicMock captures assignments. 
    # But to make it RAISE on assignment, we need a property.
    
    class MockPageSetup:
        def __init__(self):
            self.Orientation = 2 # Landscape
            self._paper_size = 0
            self.Zoom = False
            self.FitToPagesWide = 1
            self.LeftMargin = 0
            self.RightMargin = 0
            self.TopMargin = 0
            self.BottomMargin = 0
            self.FitToPagesTall = False
            self.LeftHeader = ""
            self.CenterHeader = ""
            self.RightHeader = ""
            self.LeftFooter = ""
            self.CenterFooter = ""
            self.RightFooter = ""
            self.BlackAndWhite = False
            self.Application = MagicMock()  # Required for validation

        @property
        def PaperSize(self):
            return self._paper_size
            
        @PaperSize.setter
        def PaperSize(self, value):
            if value == xlPaperLetter:
                print(f"  -> MockPrinter: Rejecting Letter ({value})")
                raise Exception("Rejected")
            print(f"  -> MockPrinter: Accepting {value}")
            self._paper_size = value

    sheet.PageSetup = MockPageSetup()
    
    print("Running _apply_page_setup...")
    converter._apply_page_setup(sheet, settings, "test.xlsx", 10)
    
    final_size = sheet.PageSetup.PaperSize
    print(f"\nFinal PaperSize: {final_size}")
    
    if final_size == xlPaperLegal:
        print("PASS: Successfully fell back to Legal (5)")
    else:
        print(f"FAIL: Expected Legal (5), got {final_size}")
        sys.exit(1)

if __name__ == "__main__":
    test_fallback_logic()
