import win32com.client
import pathlib

def debug_page_size():
    input_file = pathlib.Path("input/test_large_columns.xlsx").resolve()
    print(f"Testing on {input_file}")
    
    excel = win32com.client.Dispatch("Excel.Application")
    excel.Visible = False
    
    try:
        wb = excel.Workbooks.Open(str(input_file))
        ws = wb.ActiveSheet
        ps = ws.PageSetup
        
        print(f"Current PaperSize: {ps.PaperSize}")
        print(f"Current Orientation: {ps.Orientation}")
        
        # Try to read PageWidth (returns points)
        try:
            # Note: PageWidth/PageHeight are read-only in most docs, but let's check
            print(f"Read Width: {ps.PageWidth} points")
            print(f"Read Height: {ps.PageHeight} points")
        except Exception as e:
            print(f"Could not read dimensions: {e}")
            
        # Try to set Zoom = False, FitToPages = False
        ps.Zoom = False
        ps.FitToPagesWide = 1
        ps.FitToPagesTall = False
        
        print("Set FitToPagesWide=1, Tall=False")
        
        # Try to set custom PaperSize? 
        # xlPaperUser = 256?
        try:
            print("Attempting to set PaperSize to 256 (User)...")
            ps.PaperSize = 256
            print(f"Set PaperSize result: {ps.PaperSize}")
        except Exception as e:
            print(f"Failed to set custom paper size: {e}")

        # Try to set dimensions?
        try:
             # 50 inches * 72 = 3600 points
             print("Attempting to write to PageWidth...")
             ps.PageWidth = 3600
             print("Success writing PageWidth")
        except Exception as e:
             print(f"Failed writing PageWidth: {e}")

    finally:
        wb.Close(SaveChanges=False)
        excel.Quit()

if __name__ == "__main__":
    debug_page_size()
