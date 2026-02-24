# Microsoft Print to PDF Setup Guide

This guide explains how to configure "Microsoft Print to PDF" for use with doc2pdf, enabling larger page sizes like A3.

## The Problem

doc2pdf attempts to use "Microsoft Print to PDF" to enable A3 and larger paper sizes. However, Windows assigns dynamic port names (e.g., `Ne00:`, `Ne01:`) to printers, and these ports can conflict with other virtual printers.

## Quick Fix: Set as Default Printer

The simplest solution is to set "Microsoft Print to PDF" as your default printer:

1. Open **Settings** > **Devices** > **Printers & scanners**
2. Find **Microsoft Print to PDF**
3. Click it and select **Set as default**

This forces Windows to prioritize this printer's port, resolving conflicts.

## Troubleshooting

### Printer Not Installed

If "Microsoft Print to PDF" is not listed:

1. Open **Settings** > **Apps** > **Optional features**
2. Click **Add a feature**
3. Search for "Microsoft Print to PDF"
4. Install it and restart your computer

### Re-enable via Windows Features

1. Press `Win + R`, type `optionalfeatures`, press Enter
2. Check **Microsoft Print to PDF**
3. Click OK and restart

### Reinstall via Command Line

Open **PowerShell as Administrator** and run:

```powershell
# Remove (if corrupted)
Remove-Printer -Name "Microsoft Print to PDF"

# Reinstall
Enable-WindowsOptionalFeature -Online -FeatureName Printing-PrintToPDFServices-Features
```

## Verify Installation

Run this in doc2pdf's virtual environment to check if the printer is detected:

```bash
python -c "import win32print; printers = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL, None, 2); print([p['pPrinterName'] for p in printers if 'PDF' in p['pPrinterName']])"
```

Expected output: `['Microsoft Print to PDF']`

## Notes

- doc2pdf uses `ExportAsFixedFormat` for PDF export, which does not strictly require ActivePrinter for page sizing.
- A3 paper sizes set via `PageSetup.PaperSize` should work regardless of printer, as long as the printer driver supports them.
- If A3 still doesn't work, try converting a smaller test file while "Microsoft Print to PDF" is the **default** printer.
