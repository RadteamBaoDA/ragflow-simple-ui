import win32com.client
import os
from pathlib import Path

# Path for temporary test file
TEST_FILE = Path("test_shapes.xlsx")
if TEST_FILE.exists():
    TEST_FILE.unlink()

def create_test_file():
    excel = win32com.client.Dispatch("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False
    
    try:
        wb = excel.Workbooks.Add()
        sheet = wb.Worksheets(1)
        
        # Add some data in A1
        sheet.Range("A1").Value = "Start Data"
        
        # Add data in C3 (Cell Bounds)
        sheet.Range("C3").Value = "End Data"
        
        # Add a Shape (Rectangle) that goes beyond C3
        # Left, Top, Width, Height
        # Place it roughly around E10
        # 300 pts left, 200 pts top
        shape = sheet.Shapes.AddShape(1, 300, 200, 100, 100) # msoShapeRectangle=1
        
        # Where does this land?
        # Approximately col E-F, Row 10-15 depending on row/col sizes.
        # Let's verify via COM what BottomRightCell is roughly
        br = shape.BottomRightCell
        print(f"Created shape ending at Row {br.Row}, Col {br.Column}")
        
        wb.SaveAs(str(TEST_FILE.resolve()))
        wb.Close()
        print(f"Created {TEST_FILE}")
        
    finally:
        excel.Quit()

def verify_bounds():
    from src.core.excel_converter import ExcelConverter
    
    converter = ExcelConverter()
    
    # We need to run _get_true_used_bounds on this file
    # We can access it via a helper context, or just replicate the COM open part
    excel = win32com.client.Dispatch("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False
    
    try:
        wb = excel.Workbooks.Open(str(TEST_FILE.resolve()))
        sheet = wb.Worksheets(1)
        
        # Call the protected method (we are verifying logic here)
        last_row, last_col = converter._get_true_used_bounds(sheet)
        
        print(f"Detected Bounds: Row {last_row}, Col {last_col}")
        
        # Verify
        # Data ends at C3 (Row 3, Col 3)
        # Shape should extend it significantly
        if last_row > 5 and last_col > 3:
             print("SUCCESS: Bounds extended to include shape.")
        else:
             print("FAILURE: Bounds did not include shape.")
             raise AssertionError("Bounds were not updated for shape.")
             
        wb.Close(SaveChanges=False)
    finally:
        excel.Quit()

if __name__ == "__main__":
    try:
        create_test_file()
        verify_bounds()
        print("Verification Passed")
    except Exception as e:
        print(f"Verification Failed: {e}")
        exit(1)
    finally:
        if TEST_FILE.exists():
            try:
                TEST_FILE.unlink()
            except:
                pass
