import win32print
import win32com.client

def list_printers():
    print("Enumerating printers via win32print...")
    try:
        printers = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
        for p in printers:
            # p is (flags, description, name, comment)
            print(f"  Name: {p[2]}")
    except Exception as e:
        print(f"Error enumerating: {e}")

    print("\nChecking Excel ActivePrinter expect format...")
    try:
        excel = win32com.client.Dispatch("Excel.Application")
        excel.Visible = False
        print(f"Current ActivePrinter: {excel.ActivePrinter}")
        
        # Try setting Microsoft Print to PDF
        try:
             # Try simple name
             target = "Microsoft Print to PDF"
             print(f"Attempting to set: '{target}'")
             excel.ActivePrinter = target
             print(f"Success! ActivePrinter is now: {excel.ActivePrinter}")
        except Exception as e:
             print(f"Failed setting '{target}': {e}")
             
        excel.Quit()
    except Exception as e:
        print(f"Excel error: {e}")

if __name__ == "__main__":
    list_printers()
