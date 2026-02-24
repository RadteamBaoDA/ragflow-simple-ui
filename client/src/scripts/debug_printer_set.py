import win32com.client

def test_set_printer():
    try:
        excel = win32com.client.Dispatch("Excel.Application")
        try:
            target = "Microsoft Print to PDF on PORTPROMPT:"
            print(f"Trying: '{target}'")
            excel.ActivePrinter = target
            print("Success!")
        except Exception as e:
            print(f"Failed: {e}")
            
        excel.Quit()
    except:
        pass

if __name__ == "__main__":
    test_set_printer()
