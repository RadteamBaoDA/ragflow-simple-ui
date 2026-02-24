import winreg

def check_registry_printers():
    path = r"Software\Microsoft\Windows NT\CurrentVersion\Devices"
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, path)
        print(f"Reading {path}...")
        i = 0
        while True:
            try:
                name, value, _ = winreg.EnumValue(key, i)
                # value format often: "winspool,Ne02:" or "winspool,PORTPROMPT:"
                print(f"  {name} -> {value}")
                i += 1
            except OSError:
                break
        winreg.CloseKey(key)
    except Exception as e:
        print(f"Error reading registry: {e}")

if __name__ == "__main__":
    check_registry_printers()
