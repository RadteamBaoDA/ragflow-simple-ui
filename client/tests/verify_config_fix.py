
import sys
import os
from pathlib import Path

# Add src to path
sys.path.append(str(Path(".").absolute()))

from src.config import get_excel_sheet_settings

def verify():
    settings = get_excel_sheet_settings("Sheet1")
    print(f"Loaded min_shrink_factor: {settings.excel.min_shrink_factor}")
    
    # We expect 0.5 because the user modified config.yml to 0.5
    if settings.excel.min_shrink_factor == 0.5:
        print("SUCCESS: Config loaded correctly.")
        sys.exit(0)
    else:
        print(f"FAILURE: Expected 0.5, got {settings.excel.min_shrink_factor}")
        sys.exit(1)

if __name__ == "__main__":
    verify()
