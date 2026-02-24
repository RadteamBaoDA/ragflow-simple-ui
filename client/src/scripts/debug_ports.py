import win32print

def check_ports():
    try:
        flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
        printers = win32print.EnumPrinters(flags, None, 2) # Level 2 gives detailed info
        for p in printers:
            # p['pPrinterName'], p['pPortName']
            name = p.get('pPrinterName')
            port = p.get('pPortName')
            print(f"Printer: '{name}', Port: '{port}'")
            
            if name == "Microsoft Print to PDF":
                print(f"  -> FOUND TARGET: {name} on {port}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_ports()
