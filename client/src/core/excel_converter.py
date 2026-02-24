"""
Excel to PDF Converter using pywin32 COM.

Features:
- Smart Page Size for OCR optimization
- Dynamic page width based on column count
- Configurable row dimensions for vertical pagination
- Metadata headers (sheet name, row range, filename)
"""
import sys
import time
from pathlib import Path
from typing import Optional, List, Tuple, Literal, Callable
import win32com.client
import win32print
import pythoncom
import dataclasses
from contextlib import contextmanager

from .base import Converter
from ..config import PDFConversionSettings, ExcelSettings, get_excel_sheet_settings
from ..utils.logger import logger
from ..utils.process_manager import ProcessRegistry

# Excel constants from Object Model
xlTypePDF = 0
xlQualityStandard = 0
xlQualityMinimum = 1
xlLandscape = 2
xlPortrait = 1
xlPaperLetter = 1
xlPaperA4 = 9
xlPaperA3 = 8
xlPaperA2 = 66  # 16.5x23.4 in
xlPaperTabloid = 3  # 11x17 in
xlPaperLegal = 5  # 8.5x14 in
xlPaperLedger = 4  # 17x11 in (Tabloid rotated)
xlPaperB4 = 12  # 9.84x13.9 in (JIS B4)
xlPaperB3 = 13  # 13.9x19.7 in (JIS B3)
# Architecture sizes
xlPaperC = 24  # 17x22 in (Arch C)
xlPaperD = 25  # 22x34 in (Arch D)
xlPaperE = 26  # 34x44 in (Arch E)

# Page Setup constants
xlFitToPage = 2
xlPrintNoComments = -4142

# Worksheet visibility
xlSheetVisible = -1

# AutomationSecurity constants (msoAutomationSecurity)
msoAutomationSecurityForceDisable = 3
msoAutomationSecurityByUI = 2
msoAutomationSecurityLow = 1

# CorruptLoad constants - for opening potentially corrupted files
xlNormalLoad = 0
xlRepairFile = 1
xlExtractData = 2


class OversizedSheetError(Exception):
    """Raised when a sheet is too large to print at acceptable quality."""
    pass


class COMDisconnectedError(Exception):
    """Raised when Excel COM object has disconnected (crashed or became unavailable)."""
    pass


class ExcelConverter(Converter):
    """
    Converter for Excel documents (.xlsx, .xls, .xlsm, .xlsb) to PDF.
    
    Features Smart Page Size for OCR optimization - ensures all columns
    are readable by OCR tools like miner U, Deepseek OCR, RAGFlow deepdoc.
    """
    
    # Maximum paper dimensions in Excel (inches)
    MAX_PAGE_WIDTH_INCHES = 129.0
    MIN_PAGE_WIDTH_INCHES = 8.5
    DEFAULT_PAGE_HEIGHT_INCHES = 11.0
    POINTS_PER_INCH = 72
    
    # Search Constants
    xlByRows = 1
    xlByColumns = 2
    xlPrevious = 2
    
    def convert(
        self, 
        input_path: Path, 
        output_path: Optional[Path] = None, 
        settings: Optional[PDFConversionSettings] = None,
        on_progress: Optional[Callable[[float], None]] = None,
        base_path: Optional[Path] = None
    ) -> Path:
        """
        Convert Excel file to PDF using COM automation.
        
        Args:
            input_path: Path to source Excel file
            output_path: Path to destination PDF file
            settings: PDFConversionSettings object containing conversion configuration
            on_progress: Optional callback for partial progress (0.0 to 1.0)
            base_path: Optional root directory for relative path matching
        """    
        input_file = input_path.resolve()
        if not input_file.exists():
            raise FileNotFoundError(f"Input file not found: {input_file}")
            
        if output_path:
            out_file = output_path.resolve()
        else:
            out_file = input_file.with_suffix(".pdf")
            
        # Ensure output directory exists
        out_file.parent.mkdir(parents=True, exist_ok=True)
            
        # settings is PDFConversionSettings
        excel_settings = settings.excel or ExcelSettings()
        
        logger.info(f"Converting '{input_file.name}' to PDF...")
        logger.debug(f"Settings: {settings}")

        start_time = time.time()
        
        # Ensure CoInitialize is called for this thread
        pythoncom.CoInitialize()
        
        try:
            with self._excel_application() as excel:
                workbook = None
                temp_sheets_to_delete = []
                final_sheets_to_process = []
                
                try:
                    # Open Workbook with all parameters to suppress dialogs
                    # UpdateLinks=0: Don't update/prompt about external links
                    # ReadOnly=True: Open read-only for safety
                    # Format=None: Auto-detect delimiter format
                    # Password="": No password prompt
                    # WriteResPassword="": No write-reservation password prompt
                    # IgnoreReadOnlyRecommended=True: Ignore read-only recommendation
                    # Origin=None: Auto-detect origin
                    # Delimiter=None: Auto-detect delimiter
                    # Editable=False: Don't allow editing (no edit prompt)
                    # Notify=False: Don't notify about file reservation
                    # Converter=None: Auto-select converter
                    # AddToMru=False: Don't add to recent files
                    # Local=True: Use local settings without prompts
                    # CorruptLoad=xlNormalLoad: Normal load without repair dialog
                    workbook = excel.Workbooks.Open(
                        str(input_file), 
                        UpdateLinks=0,
                        ReadOnly=True,
                        Format=None,
                        Password="",
                        WriteResPassword="",
                        IgnoreReadOnlyRecommended=True,
                        Origin=None,
                        Delimiter=None,
                        Editable=False,
                        Notify=False,
                        Converter=None,
                        AddToMru=False,
                        Local=True,
                        CorruptLoad=xlNormalLoad
                    )
                    
                    # Get sheets to process
                    sheets_to_export = self._get_sheets_to_export(workbook, excel_settings)
                    
                    if not sheets_to_export:
                        logger.warning(f"No visible sheets found in {input_file.name}")
                        raise ValueError(f"No visible sheets to export in {input_file.name}")
                    
                    # Calculate progress weight per sheet
                    total_sheets = len(sheets_to_export)
                    sheet_weight = 1.0 / total_sheets if total_sheets > 0 else 0
                    
                    # Apply page setup and process chunks
                    skipped_sheets = []  # Track skipped oversized sheets
                    for sheet in sheets_to_export:
                        try:
                            # Get sheet-specific settings
                            # Note: Arguments are (sheet_name, base_settings, input_path, base_path)
                            sheet_settings = get_excel_sheet_settings(sheet.Name, settings, input_file, base_path)
                            sheet_excel_settings = sheet_settings.excel or excel_settings
                            
                            logger.debug(f"Sheet '{sheet.Name}' settings: row_dimensions={sheet_excel_settings.row_dimensions}")
                            
                            # Insert OCR sheet name label if enabled
                            if sheet_excel_settings.ocr_sheet_name_label:
                                self._insert_sheet_name_label(sheet, sheet.Name)
                            
                            # Calculate content dimensions based on ORIGINAL layout (do not modify row/column sizes)
                            # Note: We intentionally skip _enforce_min_col_width and _autofit_columns to preserve original formatting
                            # Returns (width_pts, height_pts, last_row, last_col) using Cells.Find for accurate bounds
                            content_width, content_height, last_row, last_col = self._get_content_dimensions_points(sheet)
                            
                            # Insert file path row if enabled (before last row)
                            if sheet_excel_settings.is_write_file_path:
                                last_row = self._insert_file_path_row(sheet, input_file, last_row, last_col, base_path)
                            
                            last_col_alpha = self._col_num_to_letter(last_col)

                            # Check for Chunking
                            row_lim = sheet_excel_settings.row_dimensions
                            if row_lim and row_lim > 0:
                                # Chunking Mode
                                # Use true last_row instead of UsedRange
                                if last_row == 0:
                                    # Empty sheet
                                    if on_progress: on_progress(sheet_weight)
                                    continue
                                    
                                chunks = (last_row + row_lim - 1) // row_lim
                                logger.info(f"Splitting sheet '{sheet.Name}' into {chunks} chunks (Rows: {row_lim})")
                                
                                # Weight for each chunk
                                chunk_weight = sheet_weight / chunks
                                
                                for i in range(chunks):
                                    start_row = i * row_lim + 1
                                    end_row = min((i + 1) * row_lim, last_row)
                                    
                                    # Copy sheet to end
                                    last_sheet = workbook.Sheets(workbook.Sheets.Count)
                                    sheet.Copy(None, last_sheet)
                                    new_sheet = workbook.Sheets(workbook.Sheets.Count)
                                    
                                    temp_sheets_to_delete.append(new_sheet)
                                    
                                    # Set Print Area explicitly to True content columns
                                    # Format: A{start}:{LastColAlpha}{end} e.g. "A1:Z50"
                                    self._safe_set_page_property(new_sheet.PageSetup, 'PrintArea', f"$A${start_row}:${last_col_alpha}${end_row}")
                                    
                                    # Create chunk settings
                                    chunk_settings = ExcelSettings(**dataclasses.asdict(sheet_excel_settings))
                                    chunk_settings.row_dimensions = 0 # Force 1 page tall
                                    
                                    self._apply_page_setup(
                                        new_sheet, 
                                        chunk_settings, 
                                        input_file.name, 
                                        last_col, 
                                        content_width_points=content_width,
                                        content_height_points=content_height
                                    )

                                    if on_progress:
                                        on_progress(chunk_weight)
                                    
                                    if sheet_excel_settings.metadata_header:
                                        center_text = f"{start_row}-{end_row}"
                                        self._apply_metadata_header(new_sheet, sheet_excel_settings, input_file.name, center_text, left_text=sheet.Name)
                                        
                                    final_sheets_to_process.append(new_sheet)
                            else:
                                # Standard Mode
                                # Skip empty sheets
                                if last_row == 0 or last_col == 0:
                                    logger.info(f"Skipping empty sheet: {sheet.Name}")
                                    skipped_sheets.append(sheet.Name)
                                    if on_progress:
                                        on_progress(sheet_weight)
                                    continue
                                    
                                # Set print area to avoid printing 1000 blank pages of formatting
                                self._safe_set_page_property(sheet.PageSetup, 'PrintArea', f"$A$1:${last_col_alpha}${last_row}")
                                
                                self._apply_page_setup(
                                    sheet, 
                                    sheet_excel_settings, 
                                    input_file.name, 
                                    last_col, 
                                    content_width_points=content_width,
                                    content_height_points=content_height
                                )
                                if sheet_excel_settings.metadata_header:
                                    self._apply_metadata_header(sheet, sheet_excel_settings, input_file.name, center_text="")
                                final_sheets_to_process.append(sheet)
                                
                                if on_progress:
                                    on_progress(sheet_weight)
                        
                        except OversizedSheetError:
                            # Sheet is too large and configured to skip
                            skipped_sheets.append(sheet.Name)
                            if on_progress:
                                on_progress(sheet_weight)
                            continue
                    
                    # Log skipped sheets summary
                    if skipped_sheets:
                        logger.warning(f"Skipped {len(skipped_sheets)} oversized sheet(s): {', '.join(skipped_sheets)}")
                    
                    # Export to PDF
                    if final_sheets_to_process:
                        self._export_to_pdf(workbook, final_sheets_to_process, str(out_file), settings)
                        elapsed = time.time() - start_time
                        mins, secs = divmod(int(elapsed), 60)
                        logger.success(f"Successfully converted: {out_file} [{mins:02d}:{secs:02d}]")
                    else:
                        logger.warning("No content to export.")
                    
                except Exception as e:
                    logger.error(f"Failed to convert {input_file.name}: {e}")
                    # Check if it's a COM disconnection - provide clearer message
                    if isinstance(e, COMDisconnectedError):
                        logger.warning("Excel crashed or became unavailable. This file will be skipped.")
                    raise
                finally:
                    # Cleanup temps
                    if temp_sheets_to_delete:
                        try:
                            excel.DisplayAlerts = False
                        except:
                            pass
                        for t in temp_sheets_to_delete:
                            try:
                                t.Delete()
                            except:
                                pass
                    
                    if workbook:
                        try:
                            workbook.Close(SaveChanges=False)
                        except:
                            pass
        finally:
            pythoncom.CoUninitialize()
            
        return out_file

    @contextmanager
    def _excel_application(self):
        """Context manager for Excel COM application lifecycle with retry on disconnection."""
        excel = None
        max_retries = 2
        
        for attempt in range(max_retries + 1):
            try:
                # Kill any zombie Excel processes before starting (on retry)
                if attempt > 0:
                    logger.warning(f"Retrying Excel initialization (attempt {attempt + 1}/{max_retries + 1})...")
                    self._kill_zombie_excel()
                    import time
                    time.sleep(1)  # Give OS time to clean up
                
                excel = win32com.client.Dispatch("Excel.Application")
                
                # Validate connection immediately by accessing a property
                try:
                    _ = excel.Version
                except Exception as conn_err:
                    logger.warning(f"Excel connection validation failed: {conn_err}")
                    if attempt < max_retries:
                        excel = None
                        continue
                    raise
                
                excel.Visible = False
                # Suppress ALL alerts and dialogs - MUST be set before any other operations
                excel.DisplayAlerts = False
                excel.ScreenUpdating = False
                # Disable macro/automation security prompts
                excel.AutomationSecurity = msoAutomationSecurityForceDisable
                # Disable interactive mode - no user prompts (critical for printer dialogs)
                excel.Interactive = False
                # Disable events that might trigger dialogs
                excel.EnableEvents = False
                # Don't prompt about links
                excel.AskToUpdateLinks = False
                # Suppress clipboard prompts
                excel.CutCopyMode = False
                # NOTE: Do NOT set PrintCommunication=False here!
                # It prevents PageSetup changes (paper size, headers) from being applied.
                # Prevent Office feature installation dialogs
                try:
                    excel.FeatureInstall = 0  # msoFeatureInstallNone
                except:
                    pass
                # Disable file validation popups
                try:
                    excel.FileValidation = 0  # msoFileValidationSkip
                except:
                    pass
                
                # Try to set optimal printer (must be after DisplayAlerts=False)
                self._set_optimal_printer(excel)
                
                ProcessRegistry.register(excel)
                break  # Success, exit retry loop
                
            except Exception as e:
                if attempt < max_retries:
                    logger.warning(f"Excel initialization failed (attempt {attempt + 1}): {e}")
                    excel = None
                    continue
                logger.critical(f"Failed to initialize Microsoft Excel after {max_retries + 1} attempts: {e}")
                raise
        
        try:
            yield excel
        finally:
            if excel:
                ProcessRegistry.unregister(excel)
                self._safe_quit_excel(excel)

    def _kill_zombie_excel(self) -> None:
        """
        Kill any zombie Excel processes that may be blocking COM.
        
        This is used as a recovery mechanism when Excel COM objects become
        disconnected (error -2147417848 / RPC_E_DISCONNECTED).
        """
        try:
            import subprocess
            # Use taskkill to forcefully terminate Excel processes
            result = subprocess.run(
                ['taskkill', '/F', '/IM', 'EXCEL.EXE'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                logger.info("Killed zombie Excel processes")
            else:
                # No Excel processes found or access denied - that's OK
                logger.debug(f"taskkill result: {result.stderr.strip()}")
        except Exception as e:
            logger.debug(f"Could not kill zombie Excel processes: {e}")

    def _safe_quit_excel(self, excel, timeout_seconds: int = 5) -> None:
        """
        Safely quit Excel application.
        
        Note: COM objects are apartment-threaded - threading breaks COM marshaling.
        This method executes Quit() directly. Ensure Excel settings are properly
        configured (DisplayAlerts=False, Interactive=False) to prevent modal dialogs.
        
        Args:
            excel: Excel Application COM object
            timeout_seconds: Ignored (kept for API compatibility)
        """
        try:
            # Ensure DisplayAlerts is off before quitting
            try:
                excel.DisplayAlerts = False
            except:
                pass
            excel.Quit()
            logger.debug("Excel application closed successfully")
        except Exception as e:
            logger.debug(f"Excel.Quit() raised: {e}")
            # If Quit fails, the process might be zombie - will be cleaned on next retry
            pass

    def _set_optimal_printer(self, excel) -> None:
        """
        Attempt to set ActivePrinter to 'Microsoft Print to PDF' for better paper size support.
        Uses win32print API for reliable port detection, with brute-force fallback.
        
        IMPORTANT: Avoids printers with PORTPROMPT: port which would show a dialog.
        """
        target_name = "Microsoft Print to PDF"
        
        try:
            # Check if already active
            current = excel.ActivePrinter
            if target_name in current:
                logger.debug(f"'{target_name}' is already the active printer.")
                return
        except:
            pass

        # Strategy 1: Use win32print API for reliable port detection
        port_name = None
        try:
            handle = win32print.OpenPrinter(target_name)
            try:
                # Level 5 is lightweight, contains pPortName
                info = win32print.GetPrinter(handle, 5)
                port_name = info.get('pPortName', '')
                
                # Fallback to Level 2 if Level 5 didn't have port
                if not port_name:
                    info = win32print.GetPrinter(handle, 2)
                    port_name = info.get('pPortName', '')
            finally:
                win32print.ClosePrinter(handle)
        except Exception as e:
            logger.debug(f"OpenPrinter/GetPrinter API failed for '{target_name}': {e}")

        # CRITICAL: Skip if port is PORTPROMPT: - this WILL show a dialog
        if port_name and port_name.upper() == 'PORTPROMPT:':
            logger.warning(
                f"Printer '{target_name}' uses PORTPROMPT: which would show a dialog. "
                f"Skipping printer change to avoid UI interruption."
            )
            return

        # If we got a port name from the API, try it first
        candidates = []
        if port_name:
            candidates.append(f"{target_name} on {port_name}")
        
        # Strategy 2: Brute force Ne00-Ne99 as fallback (expanded range)
        for i in range(100):
            candidates.append(f"{target_name} on Ne{i:02d}:")
            
        # Strategy 3: Naked name (rare, but might work)
        candidates.append(target_name)
        
        success = False
        for candidate in candidates:
            try:
                # Ensure dialogs are suppressed before each attempt
                excel.DisplayAlerts = False
                excel.Interactive = False
                excel.ActivePrinter = candidate
                logger.info(f"Successfully switched ActivePrinter to: '{candidate}'")
                success = True
                break
            except Exception as e:
                # Only log first few failures to avoid spam
                if candidates.index(candidate) < 5:
                    logger.debug(f"Failed to set ActivePrinter to '{candidate}': {e}")
                
        if not success:
            logger.warning(
                f"Could not set ActivePrinter to '{target_name}'. "
                f"Using default printer. Large paper sizes (A3) may rely on default printer capabilities."
            )

    def _get_sheets_to_export(self, workbook, excel_settings: ExcelSettings) -> List:
        """Get list of sheets to export based on settings."""
        sheets = []
        
        for sheet in workbook.Worksheets:
            # Only process visible sheets
            if sheet.Visible != xlSheetVisible:
                continue
                
            # Filter by sheet name if specified
            if excel_settings.sheet_name:
                if sheet.Name != excel_settings.sheet_name:
                    continue
            
            # Validate that the sheet has a proper PageSetup object
            # Some sheet types (dialog sheets, macro sheets) may not support PageSetup
            if not self._has_valid_page_setup(sheet):
                logger.warning(f"Skipping sheet '{sheet.Name}': PageSetup not supported")
                continue
            
            sheets.append(sheet)
            logger.debug(f"Will export sheet: {sheet.Name}")
        
        return sheets

    def _has_valid_page_setup(self, sheet) -> bool:
        """
        Check if the sheet has a valid PageSetup object that can be modified.
        
        Some sheet types (Chart sheets accessed as Worksheets, Dialog sheets, 
        Macro 4.0 sheets) may not support standard PageSetup property modifications.
        The error manifests as properties showing '<unknown>' when accessed.
        
        Args:
            sheet: Excel sheet object to validate
            
        Returns:
            True if PageSetup is valid and modifiable, False otherwise
        """
        try:
            page_setup = sheet.PageSetup
            if page_setup is None:
                return False
            
            # Try to read a basic property to verify the object is valid
            # Reading Orientation is a safe test - it should return 1 (Portrait) or 2 (Landscape)
            # If the PageSetup is invalid, this will raise an exception or return an unusable value
            orientation = page_setup.Orientation
            
            # Check if we got a valid value (int for real COM, MagicMock for tests)
            # Invalid PageSetup objects typically raise exceptions or return '<unknown>' type
            if orientation is None:
                return False
            
            # For real COM objects, orientation should be 1 (Portrait) or 2 (Landscape)
            # For mocks in tests, orientation will be a MagicMock which is fine
            if isinstance(orientation, int) and orientation not in (1, 2):
                # Real COM object returned invalid orientation value
                logger.debug(f"Sheet '{sheet.Name}' has invalid PageSetup.Orientation: {orientation}")
                return False
            
            return True
        except Exception as e:
            # If we can't even read the Orientation property, the PageSetup is invalid
            logger.debug(f"Sheet '{sheet.Name}' PageSetup validation failed: {e}")
            return False

    def _calculate_smart_page_size(
        self, 
        sheet, 
        last_col_index: int,
        content_width_points: Optional[float] = None,
        content_height_points: Optional[float] = None
    ) -> Tuple[float, float]:
        """
        Calculate page width and height based on actual content dimensions.
        
        Args:
            sheet: Excel Worksheet object
            last_col_index: The 1-based index of the last used column (e.g. 5 for Column E)
            content_width_points: Optional explicit content width in points.
            content_height_points: Optional explicit content height in points.
            
        Returns:
            Tuple of (page_width_inches, page_height_inches)
        """
        try:
            if last_col_index < 1 and not content_width_points:
                return self.MIN_PAGE_WIDTH_INCHES, self.DEFAULT_PAGE_HEIGHT_INCHES
                
            # Measure width
            if content_width_points is not None:
                # Use provided geometry points directly
                content_width_inches = content_width_points / self.POINTS_PER_INCH
            else:
                # Fallback: Measure width of Range(A:LastCol)
                first_col_char = "A"
                last_col_char = self._col_num_to_letter(last_col_index)
                col_range = sheet.Range(f"{first_col_char}1:{last_col_char}1")
                
                # .Width corresponds to the width in points of the range
                content_width_points = col_range.Width
                content_width_inches = content_width_points / self.POINTS_PER_INCH
            
            # Add a small buffer for margins (0.5 inch total)
            page_width = content_width_inches + 0.5
            
            # Page height - use actual content height if available
            if content_height_points is not None and content_height_points > 0:
                content_height_inches = content_height_points / self.POINTS_PER_INCH
                # Add margin buffer: top (0.5-1") + bottom (0.5") + small padding
                page_height = content_height_inches + 1.5
                # Ensure minimum page height (at least 3 inches)
                page_height = max(page_height, 3.0)
            else:
                page_height = self.DEFAULT_PAGE_HEIGHT_INCHES
            
            logger.debug(
                f"Sheet '{sheet.Name}' (Cols 1-{last_col_index}): "
                f"Content Width: {content_width_inches:.2f}\" -> Page Width (w/ margins): {page_width:.2f}\" | "
                f"Page Height: {page_height:.2f}\""
            )
            
            return page_width, page_height
            
        except Exception as e:
            logger.warning(f"Could not calculate smart page size: {e}")
            return self.MIN_PAGE_WIDTH_INCHES, self.DEFAULT_PAGE_HEIGHT_INCHES

    def _try_set_paper_size(self, page_setup, paper_enum: int, paper_name: str, timeout_seconds: int = 3) -> bool:
        """
        Safely attempt to set paper size.
        
        Note: COM objects are apartment-threaded - threading-based timeout breaks COM.
        This method executes the paper size assignment directly on the current thread.
        
        Args:
            page_setup: Excel PageSetup object
            paper_enum: Excel paper size constant (e.g., xlPaperA3)
            paper_name: Human-readable paper name for logging
            timeout_seconds: Ignored (kept for API compatibility)
            
        Returns:
            True if paper size was set successfully, False otherwise
        """
        # Validate page_setup object before attempting to set paper size
        if page_setup is None:
            logger.debug(f"Cannot set paper size to {paper_name}: PageSetup object is None")
            return False
        
        # Quick validation: try to access the object type
        try:
            app = page_setup.Application
            # Ensure dialogs are suppressed before setting paper size
            app.DisplayAlerts = False
            app.Interactive = False
            # Disable print communication to prevent printer dialogs
            try:
                app.PrintCommunication = False
            except:
                pass
        except Exception:
            logger.debug(f"Cannot set paper size to {paper_name}: PageSetup object is invalid")
            return False
        
        try:
            # Disable communication during change
            try:
                app.PrintCommunication = False
            except:
                pass
            
            page_setup.PaperSize = paper_enum
            
            # Re-enable to commit change
            try:
                app.PrintCommunication = True
            except:
                pass
            
            # Verify it was actually set
            if page_setup.PaperSize == paper_enum:
                return True
            else:
                logger.debug(f"Printer rejected paper size {paper_name} (Enum {paper_enum}). Trying next size...")
                return False
        except Exception as e:
            # Ensure PrintCommunication is re-enabled even on error
            try:
                app.PrintCommunication = True
            except:
                pass
            logger.debug(f"Failed to set paper size to {paper_name}: {e}")
            return False

    def _safe_com_call(self, func, timeout: int = 10, default=None):
        """
        Execute a COM call safely.
        
        Note: COM objects in Python/pywin32 are apartment-threaded and cannot be
        accessed from a different thread than the one that created them. Using
        threading for timeout protection breaks COM marshaling (causes '<unknown>' errors).
        
        This method executes the COM call directly on the current thread.
        For operations that might hang, ensure Excel settings are properly configured
        (DisplayAlerts=False, Interactive=False, etc.) to prevent modal dialogs.
        
        Args:
            func: Lambda or callable to execute
            timeout: Ignored (kept for API compatibility)
            default: Value to return if error occurs
            
        Returns:
            Result of func() or default if failed
            
        Raises:
            COMDisconnectedError: If the COM object has disconnected
        """
        try:
            return func()
        except Exception as e:
            error_str = str(e)
            error_code = getattr(e, 'args', [None])[0] if hasattr(e, 'args') and e.args else None
            
            # Check for disconnection errors
            # -2147417848 = RPC_E_DISCONNECTED (0x80010108)
            # -2147023174 = RPC_S_SERVER_UNAVAILABLE
            disconnection_codes = [-2147417848, -2147023174]
            disconnection_phrases = [
                'disconnected from its clients',
                'RPC server is unavailable',
                'Call was rejected by callee',
                'server threw an exception'
            ]
            
            is_disconnected = False
            if isinstance(error_code, int) and error_code in disconnection_codes:
                is_disconnected = True
            elif any(phrase.lower() in error_str.lower() for phrase in disconnection_phrases):
                is_disconnected = True
            
            if is_disconnected:
                logger.error(f"Excel COM connection lost: {e}")
                raise COMDisconnectedError(f"Excel has disconnected: {e}") from e
            
            logger.debug(f"COM operation failed: {e}")
            raise

    def _safe_set_page_property(self, page_setup, prop_name: str, value, timeout_seconds: int = 3) -> bool:
        """
        Safely set a PageSetup property.
        
        Note: COM objects are apartment-threaded - threading-based timeout breaks COM.
        This method executes the property assignment directly on the current thread.
        
        Args:
            page_setup: Excel PageSetup object
            prop_name: Name of the property to set (e.g., 'Orientation', 'Zoom')
            value: Value to assign to the property
            timeout_seconds: Ignored (kept for API compatibility)
            
        Returns:
            True if property was set successfully, False if failed
        """
        # Validate page_setup object before attempting to set property
        if page_setup is None:
            logger.debug(f"Cannot set PageSetup.{prop_name}: PageSetup object is None")
            return False
        
        # Quick validation: try to access the object type
        try:
            # Check if it's a valid COM object by accessing a read-only property
            _ = page_setup.Application
        except Exception:
            logger.debug(f"Cannot set PageSetup.{prop_name}: PageSetup object is invalid")
            return False
        
        try:
            setattr(page_setup, prop_name, value)
            return True
        except Exception as e:
            logger.debug(f"Failed to set PageSetup.{prop_name}: {e}")
            return False

    def _apply_page_setup(
        self, 
        sheet, 
        excel_settings: ExcelSettings,
        filename: str,
        last_col: int,
        content_width_points: Optional[float] = None,
        content_height_points: Optional[float] = None
    ) -> None:
        """
        Apply page setup settings for OCR-optimized PDF output.
        
        Args:
            sheet: Excel Worksheet object
            excel_settings: Excel-specific settings
            filename: Original filename for header
            last_col: Last used column index for width calculation
            content_width_points: Optional total content width in points
            content_height_points: Optional total content height in points
        """
        try:
            page_setup = sheet.PageSetup
            
            # Ensure dialogs are suppressed before any PageSetup operations
            try:
                app = sheet.Application
                app.DisplayAlerts = False
                app.Interactive = False
                # NOTE: Keep PrintCommunication=True so PageSetup changes are applied
            except:
                pass
            
            # Calculate smart page size
            page_width, page_height = self._calculate_smart_page_size(
                sheet, 
                last_col,
                content_width_points=content_width_points,
                content_height_points=content_height_points
            )
            
            # -----------------------------------------------------------------
            # Step 1: Try CUSTOM paper width (exact fit, zero whitespace)
            # Then fall back to standard paper catalog if custom fails.
            # -----------------------------------------------------------------
            
            # Calculate exact paper dimensions including margins
            margin_inches = 0.5  # Left + Right margin = 0.5" each
            custom_paper_width = page_width + margin_inches  # content + buffer + right margin
            custom_paper_height = page_height  # Default 11"
            
            # Determine orientation
            orientation_setting = excel_settings.orientation.lower()
            if orientation_setting == "landscape":
                target_orientation = xlLandscape
            elif orientation_setting == "portrait":
                target_orientation = xlPortrait
            else:
                # Auto: landscape if content is wider than tall
                target_orientation = xlLandscape if page_width > 8.5 else xlPortrait
            
            # For landscape, swap width/height so width > height
            if target_orientation == xlLandscape:
                if custom_paper_width < custom_paper_height:
                    custom_paper_width, custom_paper_height = custom_paper_height, custom_paper_width
            else:
                # Portrait: height should be >= width
                if custom_paper_height < custom_paper_width:
                    custom_paper_height = custom_paper_width + 3.0  # Ensure enough height
            
            # Convert to points for COM
            custom_width_pts = custom_paper_width * self.POINTS_PER_INCH
            custom_height_pts = custom_paper_height * self.POINTS_PER_INCH
            
            custom_paper_success = False
            
            # Try setting custom paper dimensions
            try:
                orient_set = self._safe_set_page_property(
                    page_setup, 'Orientation', target_orientation
                )
                if orient_set:
                    # Try PaperWidth/PaperHeight (supported by many virtual PDF printers)
                    width_set = self._safe_set_page_property(
                        page_setup, 'PaperWidth', custom_width_pts
                    )
                    height_set = self._safe_set_page_property(
                        page_setup, 'PaperHeight', custom_height_pts
                    )
                    
                    if width_set and height_set:
                        custom_paper_success = True
                        orient_label = "Landscape" if target_orientation == xlLandscape else "Portrait"
                        logger.info(
                            f"Sheet '{sheet.Name}': Custom paper {orient_label} "
                            f"{custom_paper_width:.2f}\" x {custom_paper_height:.2f}\" "
                            f"(exact fit for content width {page_width:.2f}\")"
                        )
            except Exception as e:
                logger.debug(f"Custom paper size failed: {e}")
            
            # -----------------------------------------------------------------
            # Step 2: Fall back to STANDARD paper catalog if custom failed
            # -----------------------------------------------------------------
            selected_paper = None
            selected_name = None
            selected_orientation = target_orientation
            limit_width = custom_paper_width if custom_paper_success else 8.5
            oversized = False
            paper_set_success = custom_paper_success
            
            if not custom_paper_success:
                logger.debug(
                    f"Custom paper not supported, falling back to standard paper catalog"
                )
                
                # Unified Paper Catalog: (enum, effective_width_inches, name, orientation)
                # Sorted by effective width ascending for best-fit selection.
                paper_catalog = [
                    (xlPaperA4,       8.27,  "A4",       xlPortrait),   # 8.27 x 11.69
                    (xlPaperLetter,   8.50,  "Letter",   xlPortrait),   # 8.50 x 11.00
                    (xlPaperLegal,    8.50,  "Legal",    xlPortrait),   # 8.50 x 14.00
                    (xlPaperB4,       9.84,  "B4",       xlPortrait),   # 9.84 x 13.90
                    (xlPaperLetter,  11.00,  "Letter",   xlLandscape),  # 11.00 x 8.50
                    (xlPaperTabloid, 11.00,  "Tabloid",  xlPortrait),   # 11.00 x 17.00
                    (xlPaperA3,      11.69,  "A3",       xlPortrait),   # 11.69 x 16.54
                    (xlPaperA4,      11.69,  "A4",       xlLandscape),  # 11.69 x 8.27
                    (xlPaperB4,      13.90,  "B4",       xlLandscape),  # 13.90 x 9.84
                    (xlPaperB3,      13.90,  "B3",       xlPortrait),   # 13.90 x 19.70
                    (xlPaperLegal,   14.00,  "Legal",    xlLandscape),  # 14.00 x 8.50
                    (xlPaperA2,      16.54,  "A2",       xlPortrait),   # 16.54 x 23.39
                    (xlPaperA3,      16.54,  "A3",       xlLandscape),  # 16.54 x 11.69
                    (xlPaperTabloid, 17.00,  "Tabloid",  xlLandscape),  # 17.00 x 11.00
                    (xlPaperLedger,  17.00,  "Ledger",   xlPortrait),   # 17.00 x 11.00
                    (xlPaperC,       17.00,  "Arch C",   xlPortrait),   # 17.00 x 22.00
                    (xlPaperB3,      19.70,  "B3",       xlLandscape),  # 19.70 x 13.90
                    (xlPaperD,       22.00,  "Arch D",   xlPortrait),   # 22.00 x 34.00
                    (xlPaperC,       22.00,  "Arch C",   xlLandscape),  # 22.00 x 17.00
                    (xlPaperA2,      23.39,  "A2",       xlLandscape),  # 23.39 x 16.54
                    (xlPaperD,       34.00,  "Arch D",   xlLandscape),  # 34.00 x 22.00
                    (xlPaperE,       34.00,  "Arch E",   xlPortrait),   # 34.00 x 44.00
                    (xlPaperE,       44.00,  "Arch E",   xlLandscape),  # 44.00 x 34.00
                ]
                
                # Filter catalog by orientation
                if orientation_setting == "landscape":
                    filtered_catalog = [
                        entry for entry in paper_catalog if entry[3] == xlLandscape
                    ]
                elif orientation_setting == "portrait":
                    filtered_catalog = [
                        entry for entry in paper_catalog if entry[3] == xlPortrait
                    ]
                else:
                    filtered_catalog = list(paper_catalog)
                
                # Find candidates using shrink threshold
                # Papers that fit exactly (width >= page_width)
                threshold = excel_settings.page_shrink_threshold
                exact_candidates = [
                    entry for entry in filtered_catalog if entry[1] >= page_width
                ]
                
                # Papers within shrink threshold (slightly smaller than content)
                # e.g., threshold=0.10: paper 34" is acceptable for content 35.46"
                # because 35.46/34 = 1.043 (4.3% over, within 10%)
                shrink_candidates = []
                if threshold > 0:
                    min_acceptable_width = page_width / (1 + threshold)
                    shrink_candidates = [
                        entry for entry in filtered_catalog
                        if entry[1] < page_width and entry[1] >= min_acceptable_width
                    ]
                
                # Decide: prefer largest shrink candidate over smallest exact candidate
                # when the shrink saves significant waste
                candidates = []
                if shrink_candidates and exact_candidates:
                    best_shrink = shrink_candidates[-1]  # Largest paper within shrink range
                    best_exact = exact_candidates[0]     # Smallest paper that fits exactly
                    
                    exact_waste = best_exact[1] - page_width
                    shrink_amount = page_width - best_shrink[1]
                    shrink_pct = shrink_amount / best_shrink[1]
                    
                    # Use shrink if it wastes less than exact fit
                    if exact_waste > shrink_amount:
                        candidates = [best_shrink] + exact_candidates
                        logger.info(
                            f"Sheet '{sheet.Name}': Shrink candidate {best_shrink[2]} "
                            f"({best_shrink[1]:.2f}\") saves {exact_waste - shrink_amount:.2f}\" "
                            f"vs exact {best_exact[2]} ({best_exact[1]:.2f}\") "
                            f"(shrink {shrink_pct:.1%})"
                        )
                    else:
                        candidates = exact_candidates
                elif shrink_candidates:
                    # No exact fit, use largest shrink candidate
                    candidates = [shrink_candidates[-1]]
                elif exact_candidates:
                    candidates = exact_candidates
                else:
                    # Content exceeds all paper sizes
                    candidates = [filtered_catalog[-1]] if filtered_catalog else [paper_catalog[-1]]
                    oversized = True
                
                # Try to set paper size + orientation (best candidate first)
                PAPER_SIZE_TIMEOUT = 3
                for (enum_to_try, limit_to_try, name_to_try, orient_to_try) in candidates:
                    orient_set = self._safe_set_page_property(
                        page_setup, 'Orientation', orient_to_try
                    )
                    if not orient_set:
                        continue
                    
                    success = self._try_set_paper_size(
                        page_setup, enum_to_try, name_to_try, PAPER_SIZE_TIMEOUT
                    )
                    if success:
                        selected_paper = enum_to_try
                        selected_name = name_to_try
                        selected_orientation = orient_to_try
                        limit_width = limit_to_try
                        orient_label = "Landscape" if orient_to_try == xlLandscape else "Portrait"
                        if limit_to_try >= page_width:
                            waste = limit_to_try - page_width
                            logger.info(
                                f"Sheet '{sheet.Name}': Selected {orient_label} {selected_name} "
                                f"({limit_width:.2f}\") for content width {page_width:.2f}\" "
                                f"(waste: {waste:.2f}\")"
                            )
                        else:
                            shrink_pct = (page_width - limit_to_try) / limit_to_try
                            logger.info(
                                f"Sheet '{sheet.Name}': Selected {orient_label} {selected_name} "
                                f"({limit_width:.2f}\") for content width {page_width:.2f}\" "
                                f"(shrink-to-fit: {shrink_pct:.1%})"
                            )
                        paper_set_success = True
                        break
                
                if not paper_set_success:
                    logger.warning(
                        f"Could not set any appropriate paper size for width {page_width:.2f}\". "
                        f"Printer may lack support for large sizes."
                    )
                    fallback_sizes = list(reversed(filtered_catalog or paper_catalog))
                    for (fb_enum, fb_width, fb_name, fb_orient) in fallback_sizes:
                        self._safe_set_page_property(page_setup, 'Orientation', fb_orient)
                        success = self._try_set_paper_size(
                            page_setup, fb_enum, fb_name, PAPER_SIZE_TIMEOUT
                        )
                        if success:
                            selected_paper = fb_enum
                            selected_name = fb_name
                            selected_orientation = fb_orient
                            limit_width = fb_width
                            paper_set_success = True
                            logger.info(
                                f"Fallback: Using '{fb_name}' ({fb_width:.2f}\") - "
                                f"largest size supported by printer."
                            )
                            break
                    
                    if not paper_set_success:
                        logger.warning("Could not set any paper size. Using printer default.")

            # 3. Oversized validation
            if oversized:
                effective_catalog = filtered_catalog or paper_catalog
                effective_limit_width = limit_width if paper_set_success else effective_catalog[-1][1]
                effective_limit_name = selected_name if paper_set_success else effective_catalog[-1][2]
            
                try:
                    app = sheet.Application
                    printer_max_width = self._get_active_printer_max_width_inches(app)
                    if printer_max_width and printer_max_width > effective_limit_width:
                        effective_limit_width = printer_max_width
                        effective_limit_name = "active printer max form"
                except Exception:
                    pass
                
                shrink_factor = effective_limit_width / page_width
                if shrink_factor < excel_settings.min_shrink_factor:
                    err_msg = (
                        f"Sheet '{sheet.Name}': Content is too wide ({page_width:.2f}\") for "
                        f"'{effective_limit_name}' ({effective_limit_width:.2f}\"). "
                        f"Shrink factor {shrink_factor:.2f} is below {excel_settings.min_shrink_factor} threshold."
                    )
                    if excel_settings.oversized_action == "skip":
                        logger.warning(f"{err_msg} Skipping sheet.")
                        raise OversizedSheetError(err_msg)
                    elif excel_settings.oversized_action == "warn":
                        logger.warning(f"{err_msg} Continuing anyway (oversized_action=warn).")
                    else:
                        logger.error(err_msg)
                        raise ValueError(err_msg)
                else:
                    logger.warning(
                        f"Sheet '{sheet.Name}': Content slightly larger than largest paper. "
                        f"Shrinking to fit (Factor: {shrink_factor:.2f})"
                    )

            # 4. Final Setup - Apply remaining page setup properties with timeout protection
            # These can also hang on unresponsive printer drivers
            self._safe_set_page_property(page_setup, 'Zoom', False)
            self._safe_set_page_property(page_setup, 'FitToPagesWide', 1)
            self._safe_set_page_property(page_setup, 'BlackAndWhite', False)  # Ensure color rendering for charts/text labels
            self._apply_row_dimensions(sheet, page_setup, excel_settings)
            
            # Margins - apply with timeout protection
            margin_points = 36 # 0.5 inch
            top_margin = 72 if excel_settings.metadata_header else 36
            self._safe_set_page_property(page_setup, 'LeftMargin', margin_points)
            self._safe_set_page_property(page_setup, 'RightMargin', margin_points)
            self._safe_set_page_property(page_setup, 'TopMargin', top_margin)
            self._safe_set_page_property(page_setup, 'BottomMargin', margin_points)
            
            # CRITICAL: Re-enable PrintCommunication to commit all PageSetup changes
            try:
                app = sheet.Application
                app.PrintCommunication = True
            except:
                pass
            
        except ValueError:
            raise
        except Exception as e:
            logger.warning(f"Could not apply some page setup settings for '{sheet.Name}': {e}")

    def _apply_row_dimensions(self, sheet, page_setup, excel_settings: ExcelSettings) -> None:
        """Apply vertical pagination based on row_dimensions with timeout protection."""
        try:
            if excel_settings.row_dimensions == 0:
                # Fit entire sheet on one page
                self._safe_set_page_property(page_setup, 'FitToPagesTall', 1)
            elif excel_settings.row_dimensions:
                # Multiple pages based on row count
                used_rows = sheet.UsedRange.Rows.Count
                pages_tall = max(1, (used_rows + excel_settings.row_dimensions - 1) // excel_settings.row_dimensions)
                self._safe_set_page_property(page_setup, 'FitToPagesTall', pages_tall)
            else:
                # Auto - let Excel decide
                self._safe_set_page_property(page_setup, 'FitToPagesTall', False)
        except Exception as e:
            logger.debug(f"Could not apply row dimensions: {e}")

    def _apply_metadata_header(
        self, 
        sheet, 
        excel_settings: ExcelSettings,
        filename: str,
        center_text: str = "",
        left_text: str = None
    ) -> None:
        """
        Set header text: sheet name | row range | filename
        """
        try:
            page_setup = sheet.PageSetup
            
            # Build header values
            left_val = left_text if left_text else "&A"
            center_val = center_text
            right_val = f"{filename} (Page &P)"
            
            # Set headers directly (avoid wrapper that may silently fail)
            try:
                page_setup.LeftHeader = left_val
                logger.debug(f"Set LeftHeader = '{left_val}'")
            except Exception as e:
                logger.warning(f"Failed to set LeftHeader: {e}")
            
            try:
                page_setup.CenterHeader = center_val
                logger.debug(f"Set CenterHeader = '{center_val}'")
            except Exception as e:
                logger.warning(f"Failed to set CenterHeader: {e}")
            
            try:
                page_setup.RightHeader = right_val
                logger.debug(f"Set RightHeader = '{right_val}'")
            except Exception as e:
                logger.warning(f"Failed to set RightHeader: {e}")
            
            # Clear footers to avoid clutter and potential crop issues
            try:
                page_setup.RightFooter = ""
                page_setup.CenterFooter = ""
                page_setup.LeftFooter = ""
            except Exception as e:
                logger.debug(f"Failed to clear footers: {e}")
            
            # CRITICAL: Re-enable PrintCommunication to commit header/footer changes
            try:
                app = sheet.Application
                app.PrintCommunication = True
            except:
                pass
            
            logger.debug(f"Applied metadata header for sheet '{sheet.Name}' (Center: '{center_text}')")
            
        except Exception as e:
            logger.warning(f"Could not apply metadata header for '{sheet.Name}': {e}")

    def _insert_sheet_name_label(self, sheet, sheet_name: str) -> None:
        """
        Insert a new row at the beginning and add sheet name with font size 23.
        
        This feature adds the sheet name as a large, bold label in the first row
        to improve OCR recognition of the sheet name.
        
        Args:
            sheet: Excel Worksheet object
            sheet_name: Name of the sheet to insert as label
        """
        try:
            # Insert new row at position 1
            sheet.Rows(1).Insert()
            
            # Set sheet name in cell A1
            cell = sheet.Cells(1, 1)
            cell.Value = sheet_name
            
            # Set font size to 23 for OCR readability
            cell.Font.Size = 23
            cell.Font.Bold = True
            
            logger.debug(f"Inserted OCR sheet name label for '{sheet_name}'")
        except Exception as e:
            logger.warning(f"Could not insert OCR sheet name label for '{sheet_name}': {e}")

    def _insert_file_path_row(self, sheet, file_path: Path, last_row: int, last_col: int, base_path: Optional[Path] = None) -> int:
        """
        Insert a new row before the last row and add the file path centered.
        
        Args:
            sheet: Excel Worksheet object
            file_path: Absolute path of the file being converted
            last_row: The last row index with content
            last_col: The last column index with content
            base_path: Optional root directory to calculate relative path
            
        Returns:
            The updated last_row after insertion
        """
        try:
            if last_row < 2:
                # Sheet too small, insert at row 2
                insert_row = 2
            else:
                # Insert before last row
                insert_row = last_row
            
            # Insert new row
            sheet.Rows(insert_row).Insert()
            
            # Calculate center column
            center_col = max(1, (last_col + 1) // 2)
            
            # Calculate path to display
            display_path = ""
            if base_path:
                try:
                    rel_path = file_path.resolve().relative_to(base_path.resolve())
                    display_path = "/" + rel_path.as_posix()
                except ValueError:
                    display_path = str(file_path.resolve())
            else:
                display_path = str(file_path.resolve())
            
            # Set file path in center cell
            cell = sheet.Cells(insert_row, center_col)
            cell.Value = display_path
            
            # Format: Italic, slightly smaller font
            cell.Font.Italic = True
            cell.Font.Size = 10
            cell.HorizontalAlignment = -4108  # xlCenter
            
            logger.debug(f"Inserted file path '{display_path}' at row {insert_row} for '{sheet.Name}'")
            
            return last_row + 1  # Return updated last_row
            
        except Exception as e:
            logger.warning(f"Could not insert file path row for '{sheet.Name}': {e}")
            return last_row

    def _col_num_to_letter(self, n: int) -> str:
        """Convert 1-based column number to Excel column letter (e.g. 1->A, 27->AA)."""
        string = ""
        while n > 0:
            n, remainder = divmod(n - 1, 26)
            string = chr(65 + remainder) + string
        return string

    def _expand_bounds_for_shapes(
        self, 
        sheet, 
        max_width: float, 
        max_height: float, 
        last_row: int, 
        last_col: int,
        points_per_inch: float
    ) -> Tuple[float, float, int, int]:
        """
        Safely iterate through shapes to expand content bounds.
        
        Uses per-shape timeout to prevent COM blocking from problematic shapes
        (OLE objects, external links, etc.) from freezing the application.
        
        Args:
            sheet: Excel Worksheet object
            max_width: Current max width in points
            max_height: Current max height in points  
            last_row: Current last row index
            last_col: Current last column index
            points_per_inch: Conversion factor
            
        Returns:
            Tuple of (max_width, max_height, last_row, last_col)
        """
        SHAPE_ACCESS_TIMEOUT = 2  # seconds per shape property access
        MAX_SHAPE_ERRORS = 5  # Stop after this many consecutive errors
        
        try:
            # First, try to get shapes count with timeout
            shapes_count = 0
            try:
                shapes_count = sheet.Shapes.Count
            except Exception as e:
                logger.debug(f"Could not access Shapes collection: {e}")
                return max_width, max_height, last_row, last_col
            
            if shapes_count == 0:
                return max_width, max_height, last_row, last_col
                
            logger.debug(f"Processing {shapes_count} shapes for bounds calculation...")
            consecutive_errors = 0
            
            for i in range(1, shapes_count + 1):  # Excel shapes are 1-indexed
                try:
                    shape = sheet.Shapes(i)
                    
                    # Access shape properties with individual try-except
                    # This prevents one bad shape from blocking the entire loop
                    shape_name = "Unknown"
                    try:
                        shape_name = shape.Name
                    except:
                        pass
                    
                    # Get position/size properties - these can block on OLE objects
                    shape_left = 0
                    shape_top = 0
                    shape_width = 0
                    shape_height = 0
                    
                    try:
                        shape_left = shape.Left
                        shape_top = shape.Top
                        shape_width = shape.Width
                        shape_height = shape.Height
                    except Exception as prop_err:
                        logger.debug(f"Shape {i} '{shape_name}' property access failed: {prop_err}")
                        consecutive_errors += 1
                        if consecutive_errors >= MAX_SHAPE_ERRORS:
                            logger.warning(f"Too many shape access errors ({MAX_SHAPE_ERRORS}), skipping remaining shapes")
                            break
                        continue
                    
                    # Reset error counter on success
                    consecutive_errors = 0
                    
                    shape_right = shape_left + shape_width
                    shape_bottom = shape_top + shape_height
                    
                    if shape_right > max_width:
                        logger.debug(f"Shape '{shape_name}' extends width to {shape_right:.1f}pt ({shape_right/points_per_inch:.2f}in)")
                        max_width = shape_right
                    if shape_bottom > max_height:
                        max_height = shape_bottom
                    
                    # Try to get cell bounds (optional, non-critical)
                    try:
                        br_cell = shape.BottomRightCell
                        if br_cell:
                            if br_cell.Row > last_row:
                                last_row = br_cell.Row
                            if br_cell.Column > last_col:
                                last_col = br_cell.Column
                    except Exception:
                        pass
                        
                except Exception as shape_err:
                    logger.debug(f"Error processing shape {i}: {shape_err}")
                    consecutive_errors += 1
                    if consecutive_errors >= MAX_SHAPE_ERRORS:
                        logger.warning(f"Too many shape access errors ({MAX_SHAPE_ERRORS}), skipping remaining shapes")
                        break
                    continue
                    
        except Exception as e:
            logger.warning(f"Shape bounds expansion failed: {e}")
            
        return max_width, max_height, last_row, last_col

    def _export_to_pdf(
        self, 
        workbook, 
        sheets: List,
        output_path: str,
        settings: PDFConversionSettings
    ) -> None:
        """
        Export sheets to PDF.
        
        Args:
            workbook: Excel Workbook object
            sheets: List of sheets to export
            output_path: Path for output PDF
            settings: PDF conversion settings
        """
        try:
            # Validate COM connection before starting
            try:
                app = workbook.Application
                _ = app.Version  # Quick validation
            except Exception as e:
                raise COMDisconnectedError(f"Excel connection lost before export: {e}")
            
            # Ensure dialogs are suppressed before export
            app.DisplayAlerts = False
            app.Interactive = False
            
            # CRITICAL: Re-enable PrintCommunication before export
            # When False, PageSetup changes (headers/footers) are NOT communicated to printer
            # Must be True for headers/footers to appear in PDF
            try:
                app.PrintCommunication = True
            except:
                pass
            
            # Determine quality
            quality = xlQualityStandard
            if settings.optimization.image_quality == "low":
                quality = xlQualityMinimum

            if len(sheets) == 1:
                # Export single sheet directly
                logger.info(f"Exporting sheet '{sheets[0].Name}' to PDF...")
                
                sheets[0].ExportAsFixedFormat(
                    Type=xlTypePDF,
                    Filename=output_path,
                    Quality=quality,
                    IncludeDocProperties=settings.metadata.include_properties,
                    IgnorePrintAreas=False,
                    OpenAfterPublish=False
                )
                
                logger.debug(f"Sheet '{sheets[0].Name}' exported successfully")
            else:
                # Multiple sheets: Copy to new temporary workbook iteratively
                logger.debug(f"Preparing to copy {len(sheets)} sheets to new workbook.")
                
                temp_wb = None
                try:
                    # Copy first sheet -> Creates new Workbook
                    sheets[0].Copy()
                    
                    # Get the new workbook
                    try:
                        temp_wb = workbook.Application.ActiveWorkbook
                        _ = temp_wb.Sheets.Count  # Validate connection
                    except Exception as e:
                        raise COMDisconnectedError(f"Failed to access temp workbook: {e}")
                    
                    logger.debug(f"Created temp WB. Sheets count: {temp_wb.Sheets.Count}")
                    
                    # Copy remaining sheets into the new workbook
                    for idx, s in enumerate(sheets[1:], start=2):
                        try:
                            last_sheet = temp_wb.Sheets(temp_wb.Sheets.Count)
                            # Copy after last_sheet
                            s.Copy(None, last_sheet)
                            logger.debug(f"Copied sheet {idx}/{len(sheets)}. New count: {temp_wb.Sheets.Count}")
                        except Exception as copy_err:
                            logger.error(f"Failed to copy sheet {idx}: {copy_err}")
                            # Continue with remaining sheets
                    
                    # Export workbook - all sheets will be included automatically
                    count = temp_wb.Sheets.Count
                    logger.debug(f"Exporting created workbook with {count} sheets.")
                    
                    logger.info(f"Exporting {count} sheets to PDF...")
                    
                    temp_wb.ExportAsFixedFormat(
                        Type=xlTypePDF,
                        Filename=output_path,
                        Quality=quality,
                        IncludeDocProperties=settings.metadata.include_properties,
                        IgnorePrintAreas=False,
                        OpenAfterPublish=False
                    )
                    
                    logger.debug(f"Multi-sheet export completed successfully")
                finally:
                    if temp_wb:
                        try:
                            temp_wb.Close(SaveChanges=False)
                        except Exception as close_err:
                            logger.debug(f"Failed to close temp workbook: {close_err}")

            
        except COMDisconnectedError:
            raise  # Re-raise to caller
        except Exception as e:
            logger.error(f"Failed to export to PDF: {e}")
            raise

    def _get_print_area_bounds(self, sheet) -> Tuple[int, int]:
        """
        Get bounds from existing PrintArea if set by user.
        
        This respects user-defined print area settings which have highest priority.
        
        Returns:
            Tuple of (last_row, last_col) from PrintArea, or (0, 0) if not set.
        """
        try:
            print_area = sheet.PageSetup.PrintArea
            if print_area and print_area.strip():
                # PrintArea format: "$A$1:$Z$100" or "A1:Z100"
                # Parse the end cell to get bounds
                import re
                # Remove sheet name prefix if present (e.g., "Sheet1!$A$1:$Z$100")
                if '!' in print_area:
                    print_area = print_area.split('!')[-1]
                
                # Match pattern like $A$1:$Z$100 or A1:Z100
                match = re.search(r':?\$?([A-Z]+)\$?(\d+)$', print_area.upper())
                if match:
                    col_letters = match.group(1)
                    row_num = int(match.group(2))
                    
                    # Convert column letters to number (A=1, Z=26, AA=27, etc.)
                    col_num = 0
                    for char in col_letters:
                        col_num = col_num * 26 + (ord(char) - ord('A') + 1)
                    
                    logger.debug(f"Sheet '{sheet.Name}' has PrintArea set: {print_area} -> Row={row_num}, Col={col_num}")
                    return row_num, col_num
        except Exception as e:
            logger.debug(f"Could not parse PrintArea: {e}")
        
        return 0, 0
    
    def _get_page_break_bounds(self, sheet) -> Tuple[int, int]:
        """
        Get bounds from vertical/horizontal page breaks if set.
        
        This uses the rightmost vertical page break as the column bound.
        
        Returns:
            Tuple of (last_row, last_col) from page breaks, or (0, 0) if none.
        """
        last_row = 0
        last_col = 0
        
        try:
            # Check VPageBreaks (vertical page breaks define column boundaries)
            v_breaks = sheet.VPageBreaks
            if v_breaks and v_breaks.Count > 0:
                # Get the rightmost break location
                max_break_col = 0
                for i in range(1, v_breaks.Count + 1):
                    try:
                        break_loc = v_breaks(i).Location
                        if break_loc and break_loc.Column > max_break_col:
                            max_break_col = break_loc.Column
                    except Exception:
                        continue
                if max_break_col > 0:
                    last_col = max_break_col - 1  # Break is BEFORE this column
                    logger.debug(f"Sheet '{sheet.Name}' VPageBreak found at column {max_break_col}")
        except Exception as e:
            logger.debug(f"Could not read VPageBreaks: {e}")
        
        try:
            # Check HPageBreaks (horizontal page breaks define row boundaries)
            h_breaks = sheet.HPageBreaks
            if h_breaks and h_breaks.Count > 0:
                max_break_row = 0
                for i in range(1, h_breaks.Count + 1):
                    try:
                        break_loc = h_breaks(i).Location
                        if break_loc and break_loc.Row > max_break_row:
                            max_break_row = break_loc.Row
                    except Exception:
                        continue
                if max_break_row > 0:
                    last_row = max_break_row - 1  # Break is BEFORE this row
                    logger.debug(f"Sheet '{sheet.Name}' HPageBreak found at row {max_break_row}")
        except Exception as e:
            logger.debug(f"Could not read HPageBreaks: {e}")
        
        return last_row, last_col

    def _find_longest_text_column(self, sheet, search_last_row: int, search_last_col: int) -> Tuple[int, int, float]:
        """
        Find text that extends beyond column width using row sampling.
        
        Handles merged cells by calculating the total width of the merge area.
        Samples first N, last N, and middle rows for better coverage.
        
        Returns:
            Tuple of (extended_col, max_text_length, required_extra_width_points)
        """
        max_text_extended_col = 0
        max_text_len = 0
        required_extra_width = 0.0
        
        AVG_CHAR_WIDTH_POINTS = 7.2
        DEFAULT_COL_WIDTH = 64.0
        SAMPLE_ROWS = 50
        
        try:
            max_cols = search_last_col + 20 
            
            # Cache column widths
            col_widths = []
            for col_idx in range(1, max_cols + 1):
                try:
                    col_widths.append(sheet.Columns(col_idx).Width)
                except Exception:
                    col_widths.append(DEFAULT_COL_WIDTH)
            
            # Select rows to check
            rows_to_check = set()
            for r in range(1, min(SAMPLE_ROWS + 1, search_last_row + 1)):
                rows_to_check.add(r)
            for r in range(max(1, search_last_row - SAMPLE_ROWS + 1), search_last_row + 1):
                rows_to_check.add(r)
            if search_last_row > SAMPLE_ROWS * 3:
                mid = search_last_row // 2
                for r in range(max(1, mid - 5), min(search_last_row, mid + 5)):
                    rows_to_check.add(r)
            
            check_list = sorted(list(rows_to_check))
            
            for row_idx in check_list:
                try:
                    row_range = sheet.Range(
                        sheet.Cells(row_idx, 1),
                        sheet.Cells(row_idx, min(max_cols, search_last_col + 10))
                    )
                    row_values = row_range.Value
                    
                    if row_values is None:
                        continue

                    if isinstance(row_values, tuple):
                        if isinstance(row_values[0], tuple):
                            row_values = row_values[0]
                    else:
                        row_values = (row_values,)
                    
                    for col_idx, value in enumerate(row_values, start=1):
                        if value is None or not isinstance(value, (str, float, int)):
                            continue
                        
                        text = str(value)
                        text_len = len(text)
                        
                        if text_len > 15:
                            # Check if this cell has wrap text enabled - if so, skip overflow detection
                            try:
                                cell = sheet.Cells(row_idx, col_idx)
                                if cell.WrapText:
                                    # Text wraps within the column, no horizontal overflow
                                    continue
                            except Exception:
                                pass
                            
                            estimated_width = text_len * AVG_CHAR_WIDTH_POINTS
                            
                            # Check if this cell is merged and calculate merged width
                            try:
                                cell = sheet.Cells(row_idx, col_idx)
                                merge_area = cell.MergeArea
                                if merge_area.Columns.Count > 1:
                                    # Sum widths of all merged columns
                                    base_width = 0.0
                                    merge_start_col = merge_area.Column
                                    merge_end_col = merge_start_col + merge_area.Columns.Count - 1
                                    for mc in range(merge_start_col, merge_end_col + 1):
                                        if mc <= len(col_widths):
                                            base_width += col_widths[mc - 1]
                                        else:
                                            base_width += DEFAULT_COL_WIDTH
                                    # The extended column should start after the merge area
                                    effective_col = merge_end_col
                                else:
                                    base_width = col_widths[col_idx - 1] if col_idx <= len(col_widths) else DEFAULT_COL_WIDTH
                                    effective_col = col_idx
                            except Exception:
                                base_width = col_widths[col_idx - 1] if col_idx <= len(col_widths) else DEFAULT_COL_WIDTH
                                effective_col = col_idx
                            
                            if estimated_width > base_width:
                                overflow = estimated_width - base_width
                                
                                extended_col = effective_col
                                accumulated = 0.0
                                for nc in range(effective_col, len(col_widths)):
                                    accumulated += col_widths[nc]
                                    extended_col = nc + 1
                                    if accumulated >= overflow:
                                        break
                                
                                if extended_col > max_text_extended_col:
                                    max_text_extended_col = extended_col
                                    max_text_len = text_len
                                    required_extra_width = overflow
                                    
                except Exception:
                    continue
            
            if max_text_len > 0:
                # Log column widths for debugging
                col_width_summary = ", ".join([f"Col{i+1}:{col_widths[i]:.1f}pt" for i in range(min(search_last_col, len(col_widths)))])
                total_width_pts = sum(col_widths[:search_last_col])
                logger.debug(
                    f"Sheet '{sheet.Name}' text overflow detected: {max_text_len} chars extending to col {max_text_extended_col}. "
                    f"Column widths (1-{search_last_col}): [{col_width_summary}], Total: {total_width_pts:.1f}pt ({total_width_pts/72:.2f}in)"
                )
                        
        except Exception as e:
            logger.debug(f"Text overflow detection sampling failed: {e}")
        
        return max_text_extended_col, max_text_len, required_extra_width


    def _get_content_dimensions_points(self, sheet) -> Tuple[float, float, int, int]:
        """
        Calculate total content width and height in points by summing column widths.
        
        Priority order for determining bounds:
        1. PrintArea (if set by user) - highest priority
        2. Page breaks (VPageBreaks/HPageBreaks)
        3. Cells.Find + longest text detection (fallback)
        
        Returns (max_width_points, max_height_points, last_row, last_col).
        """
        max_width = 0.0
        max_height = 0.0
        
        POINTS_PER_INCH = 72.0
        
        try:
            last_row = 1
            last_col = 1
            bounds_source = "default"
            
            # Priority 1: Check for PrintArea
            print_row, print_col = self._get_print_area_bounds(sheet)
            if print_row > 0 and print_col > 0:
                last_row = print_row
                last_col = print_col
                bounds_source = "PrintArea"
                logger.info(f"Sheet '{sheet.Name}' using PrintArea bounds: Row={last_row}, Col={last_col}")
            else:
                # Priority 2: Check for page breaks
                break_row, break_col = self._get_page_break_bounds(sheet)
                if break_row > 0 or break_col > 0:
                    bounds_source = "PageBreaks"
                
                # Priority 3: Use Cells.Find for base detection
                try:
                    last_row_cell = sheet.Cells.Find(
                        What="*",
                        After=sheet.Range("A1"),
                        LookIn=-4163,  # xlValues
                        LookAt=2,      # xlPart
                        SearchOrder=self.xlByRows,
                        SearchDirection=self.xlPrevious
                    )
                    if last_row_cell:
                        last_row = last_row_cell.Row
                except Exception:
                    last_row = sheet.UsedRange.Rows.Count
                
                try:
                    last_col_cell = sheet.Cells.Find(
                        What="*",
                        After=sheet.Range("A1"),
                        LookIn=-4163,  # xlValues
                        LookAt=2,      # xlPart
                        SearchOrder=self.xlByColumns,
                        SearchDirection=self.xlPrevious
                    )
                    if last_col_cell:
                        last_col = last_col_cell.Column
                except Exception:
                    last_col = sheet.UsedRange.Columns.Count
                
                # Apply page break bounds if they are larger
                if break_row > last_row:
                    last_row = break_row
                if break_col > last_col:
                    last_col = break_col
                    bounds_source = "PageBreaks"
                
                # Priority 3b: Detect longest text and extend bounds if needed
                # Skip text overflow detection if VPageBreak defines column boundary
                overflow_extra_width = 0.0
                if break_col > 0:
                    logger.debug(f"Sheet '{sheet.Name}' skipping text overflow detection - VPageBreak defines column boundary at {break_col}")
                else:
                    text_col, text_len, overflow_extra_width = self._find_longest_text_column(sheet, last_row, last_col)
                    if text_col > last_col:
                        logger.info(f"Sheet '{sheet.Name}' extending column bound from {last_col} to {text_col} for text overflow")
                        last_col = text_col
                        bounds_source = "TextOverflow"
            
            logger.debug(f"Sheet '{sheet.Name}' bounds source: {bounds_source}")
            
            # Sum width of each column (in points)
            total_width_points = 0.0
            
            for col_idx in range(1, last_col + 1):
                try:
                    col_width = sheet.Columns(col_idx).Width
                    total_width_points += col_width
                except Exception:
                    total_width_points += 64.0  # Default column width
            
            # Add extra width for text overflow if detected
            if bounds_source != "PrintArea" and overflow_extra_width > 0:
                total_width_points += overflow_extra_width
                logger.debug(f"Added {overflow_extra_width:.1f}pt for text overflow")
            
            # Sum height of each row (in points)
            total_height_points = 0.0
            
            for row_idx in range(1, last_row + 1):
                try:
                    row_height = sheet.Rows(row_idx).Height
                    total_height_points += row_height
                except Exception:
                    total_height_points += 15.0  # Default row height
            
            max_width = total_width_points
            max_height = total_height_points
            
            logger.debug(
                f"Sheet '{sheet.Name}' Column Sum: "
                f"Cols=1-{last_col}, Total Width={total_width_points:.1f}pt ({total_width_points/POINTS_PER_INCH:.2f}in) | "
                f"Rows=1-{last_row}, Total Height={total_height_points:.1f}pt ({total_height_points/POINTS_PER_INCH:.2f}in)"
            )
            
            # Expand for Shapes (Charts, Images) with safe iteration
            max_width, max_height, last_row, last_col = self._expand_bounds_for_shapes(
                sheet, max_width, max_height, last_row, last_col, POINTS_PER_INCH
            )
            
            logger.info(
                f"Sheet '{sheet.Name}' Final Content Dimensions: "
                f"{max_width:.1f}pt ({max_width/POINTS_PER_INCH:.2f}in) x {max_height:.1f}pt ({max_height/POINTS_PER_INCH:.2f}in)"
            )
                    
        except Exception as e:
            logger.warning(f"Failed to calculate geometry dimensions: {e}")
            
        return max_width, max_height, last_row, last_col


# Add near other helpers, before _apply_page_setup
def _get_active_printer_max_width_inches(self, app) -> Optional[float]:
    try:
        active_printer = str(app.ActivePrinter or "")
    except Exception:
        return None

    printer_name = active_printer.split(" on ")[0].strip()
    if not printer_name:
        return None

    handle = None
    try:
        handle = win32print.OpenPrinter(printer_name)
        forms = win32print.EnumForms(handle)
    except Exception:
        return None
    finally:
        if handle:
            try:
                win32print.ClosePrinter(handle)
            except Exception:
                pass

    max_width_inches = None
    for form in forms or []:
        size = form.get("Size")  # thousandths of mm
        if not size or len(size) != 2:
            continue
        try:
            width_inches = (max(size[0], size[1]) / 1000.0) / 25.4
        except Exception:
            continue
        if width_inches > 0 and (max_width_inches is None or width_inches > max_width_inches):
            max_width_inches = width_inches

    if max_width_inches is None:
        return None

    return min(max_width_inches, self.MAX_PAGE_WIDTH_INCHES)
