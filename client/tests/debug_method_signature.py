"""
Check the actual method signature for ExportAsFixedFormat.
"""
import win32com.client
import pythoncom

pythoncom.CoInitialize()

try:
    ppt = win32com.client.gencache.EnsureDispatch("PowerPoint.Application")
    ppt.DisplayAlerts = 2
    
    # Open test file
    from pathlib import Path
    test_file = Path("input/pp/test_sample.pptx").resolve()
    presentation = ppt.Presentations.Open(str(test_file), -1, 0, 0)
    
    # Try to inspect the method
    print("Presentation object type:", type(presentation))
    print("Presentation object:", presentation)
    
    # Try getting help on the method
    method = presentation.ExportAsFixedFormat
    print("\nMethod:", method)
    print("Method type:", type(method))
    
    # Try with keyword args matching the Word version
    output_path = Path("output/test_from_debug.pdf").resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Try calling SaveAs instead to verify presentation works
    print("\nTrying SaveAs as PDF...")
    try:
        from win32com.client import constants
        presentation.SaveAs(str(output_path), constants.ppSaveAsPDF)
        print("✓ SaveAs worked!")
    except Exception as e:
        print(f"✗ SaveAs failed: {e}")
    
    presentation.Close()
    ppt.Quit()
    
finally:
    pythoncom.CoUninitialize()
