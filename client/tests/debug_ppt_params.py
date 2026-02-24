"""
Debug script to check PowerPoint ExportAsFixedFormat parameters.
"""
import win32com.client
import pythoncom
from pythoncom import VT_BSTR, VT_I4
from pathlib import Path

pythoncom.CoInitialize()

try:
    # Use DispatchEx to get early binding with constants
    ppt = win32com.client.gencache.EnsureDispatch("PowerPoint.Application")
    ppt.DisplayAlerts = 2  # ppAlertsNone
    
    # Open the test file
    test_file = Path("input/pp/test_sample.pptx").resolve()
    presentation = ppt.Presentations.Open(str(test_file), -1, 0, 0)
    
    output_path = Path("output/test_debug.pdf").resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    output_str = str(output_path)
    print(f"Output path: {output_str}")
    print(f"Output path type: {type(output_str)}")
    
    # Get the constants from PowerPoint
    from win32com.client import constants
    ppFixedFormatTypePDF = constants.ppFixedFormatTypePDF
    ppFixedFormatIntentPrint = constants.ppFixedFormatIntentPrint
    
    print(f"ppFixedFormatTypePDF = {ppFixedFormatTypePDF}")
    print(f"ppFixedFormatIntentPrint = {ppFixedFormatIntentPrint}")
    
    # Try with PowerPoint constants
    print("\nTesting with PowerPoint constants...")
    try:
        presentation.ExportAsFixedFormat(
            output_str,
            ppFixedFormatTypePDF,
            ppFixedFormatIntentPrint
        )
        print("✓ PowerPoint constants worked!")
    except Exception as e:
        print(f"✗ PowerPoint constants failed: {e}")
    
    presentation.Close()
    ppt.Quit()
    
finally:
    pythoncom.CoUninitialize()
