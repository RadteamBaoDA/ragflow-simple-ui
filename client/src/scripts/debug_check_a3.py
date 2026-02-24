import win32com.client

def check_a3():
    try:
        excel = win32com.client.Dispatch("Excel.Application")
        excel.Visible = False
        wb = excel.Workbooks.Add()
        ws = wb.ActiveSheet
        
        print(f"Current Printer: {excel.ActivePrinter}")
        print(f"Current PaperSize: {ws.PageSetup.PaperSize}")
        
        print("Attempting to set PaperSize = 8 (xlPaperA3)...")
        try:
            ws.PageSetup.PaperSize = 8
            print(f"Set successfully. New PaperSize: {ws.PageSetup.PaperSize}")
            if ws.PageSetup.PaperSize == 8:
                print("VERIFIED: A3 is supported.")
            else:
                print("FAILED: Value was ignored/reset.")
        except Exception as e:
            print(f"Error setting A3: {e}")
            
        print("Attempting to set PaperSize = 1 (xlPaperLetter)...")
        ws.PageSetup.PaperSize = 1
        print(f"Reset check: {ws.PageSetup.PaperSize}")

        wb.Close(SaveChanges=False)
        excel.Quit()
    except Exception as e:
        print(f"Main error: {e}")

if __name__ == "__main__":
    check_a3()
