import win32com.client
import time

def brute_force_printer():
    excel = win32com.client.Dispatch("Excel.Application")
    excel.Visible = False
    
    target_base = "Microsoft Print to PDF"
    
    print(f"Current: {excel.ActivePrinter}")
    
    ports_to_try = [
        "PORTPROMPT:",
        "nul:",
        "CPW2:"
    ]
    # Add Ne00 to Ne16
    for i in range(17):
        ports_to_try.append(f"Ne{i:02d}:")
        
    found = False
    for port in ports_to_try:
        candidate = f"{target_base} on {port}"
        print(f"Trying: '{candidate}' ... ", end="")
        try:
            excel.ActivePrinter = candidate
            print("SUCCESS!")
            found = True
            break
        except Exception:
            print("Fail")
            
    if not found:
        # Try raw name just in case (some versions/configs)
        print(f"Trying raw: '{target_base}' ... ", end="")
        try:
             excel.ActivePrinter = target_base
             print("SUCCESS!")
        except:
             print("Fail")

    excel.Quit()

if __name__ == "__main__":
    brute_force_printer()
