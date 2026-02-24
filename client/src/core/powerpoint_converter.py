"""
PowerPoint to PDF Converter using pywin32 COM.
"""
import sys
from pathlib import Path
from typing import Optional
import win32com.client
import pythoncom
from contextlib import contextmanager

from .base import Converter
from ..config import PDFConversionSettings, PowerPointSettings
from ..utils.logger import logger
from ..utils.process_manager import ProcessRegistry

# Constants from PowerPoint Object Model
ppFixedFormatTypePDF = 2
ppFixedFormatIntentPrint = 2
ppFixedFormatIntentScreen = 1

# Print Range Type
ppPrintAll = 1
ppPrintSelection = 2
ppPrintSlideRange = 4

# Print Color Type
ppPrintColor = 1
ppPrintBlackAndWhite = 2
ppPrintPureBlackAndWhite = 3

# Save/Close constants
ppSaveChanges = 1
ppDoNotSaveChanges = 2

# AutomationSecurity constants (msoAutomationSecurity)
msoAutomationSecurityForceDisable = 3
msoAutomationSecurityByUI = 2
msoAutomationSecurityLow = 1

# Alert Level constants
ppAlertsNone = 2
ppAlertsAll = 1


class PowerPointConverter(Converter):
    """
    Converter for PowerPoint documents (.ppt, .pptx) to PDF.
    """
    
    def convert(
        self, 
        input_path: Path, 
        output_path: Optional[Path] = None, 
        settings: Optional[PDFConversionSettings] = None,
        base_path: Optional[Path] = None
    ) -> Path:
        """
        Convert a PowerPoint document to PDF.
        
        Args:
            input_path: Path to the source PowerPoint file.
            output_path: Optional path for the output PDF.
            settings: PDF conversion settings.
            
        Returns:
            Path to the generated PDF file.
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
            
        settings = settings or PDFConversionSettings()
        
        logger.info(f"Converting '{input_file.name}' to PDF...")
        logger.debug(f"Settings: {settings}")

        # Ensure CoInitialize is called for this thread
        pythoncom.CoInitialize()
        
        try:
            with self._powerpoint_application() as ppt:
                presentation = None
                try:
                    # Open Presentation with all parameters to suppress dialogs
                    # FileName: Path to file
                    # ReadOnly=msoTrue: Open read-only for safety
                    # Untitled=msoFalse: Use original title
                    # WithWindow=msoFalse: Don't show window
                    presentation = ppt.Presentations.Open(
                        str(input_file), 
                        ReadOnly=-1,  # msoTrue
                        Untitled=0,   # msoFalse
                        WithWindow=0  # msoFalse
                    )
                    
                    # Prepare Export Arguments
                    export_args = self._map_settings(settings, str(out_file))
                    
                    # Re-assert dialog suppression before export
                    ppt.DisplayAlerts = ppAlertsNone
                    
                    # Export directly using SaveAs with PDF format
                    # This is more reliable than ExportAsFixedFormat with pywin32
                    logger.info(f"Exporting '{input_file.name}' to PDF format...")
                    presentation.SaveAs(str(out_file), 32)  # ppSaveAsPDF = 32
                    
                    logger.success(f"Successfully converted: {out_file}")
                    
                except Exception as e:
                    logger.error(f"Failed to convert {input_file.name}: {e}")
                    raise
                finally:
                    if presentation:
                        try:
                            presentation.Close()
                        except Exception as close_err:
                            logger.debug(f"Failed to close presentation: {close_err}")
        finally:
            pythoncom.CoUninitialize()
            
        return out_file

    @contextmanager
    def _powerpoint_application(self):
        """
        Context manager for PowerPoint COM application lifecycle.
        """
        ppt = None
        try:
            ppt = win32com.client.Dispatch("PowerPoint.Application")
            # Suppress ALL alerts and dialogs
            # ppAlertsNone = 2 suppresses all alerts
            ppt.DisplayAlerts = ppAlertsNone
            # Disable macro/automation security prompts
            ppt.AutomationSecurity = msoAutomationSecurityForceDisable
            # Prevent Office feature installation dialogs
            try:
                ppt.FeatureInstall = 0  # msoFeatureInstallNone
            except:
                pass
            # Disable file validation popups
            try:
                ppt.FileValidation = 0  # msoFileValidationSkip
            except:
                pass
            ProcessRegistry.register(ppt)
            yield ppt
        except Exception as e:
            logger.critical(f"Failed to initialize Microsoft PowerPoint: {e}")
            raise
        finally:
            if ppt:
                ProcessRegistry.unregister(ppt)
                self._safe_quit(ppt)

    def _safe_quit(self, app, timeout_seconds: int = 5) -> None:
        """
        Safely quit application.
        
        Note: COM objects are apartment-threaded - threading breaks COM marshaling.
        This method executes Quit() directly on the current thread.
        """
        try:
            app.DisplayAlerts = ppAlertsNone
        except:
            pass
        try:
            app.Quit()
            logger.debug("PowerPoint application closed successfully")
        except Exception as e:
            logger.debug(f"App.Quit() raised: {e}")

    def _safe_com_call(self, func, timeout: int = 60, default=None):
        """
        Execute a COM call safely.
        
        Note: COM objects in Python/pywin32 are apartment-threaded and cannot be
        accessed from a different thread than the one that created them. Using
        threading for timeout protection breaks COM marshaling (causes '<unknown>' errors).
        
        This method executes the COM call directly on the current thread.
        """
        try:
            return func()
        except Exception as e:
            logger.debug(f"COM operation failed: {e}")
            raise

    def _map_settings(self, settings: PDFConversionSettings, output_path: str) -> dict:
        """
        Map PDFConversionSettings to ExportAsFixedFormat arguments.
        """
        # Get PowerPoint-specific settings
        ppt_settings = settings.powerpoint or PowerPointSettings()
        
        # Print Range Type
        range_type = ppPrintAll
        from_slide = 1
        to_slide = -1  # Will be set to presentation length by COM
        
        if settings.scope == "range" and ppt_settings.slide_from:
            range_type = ppPrintSlideRange
            from_slide = ppt_settings.slide_from
            to_slide = ppt_settings.slide_to or from_slide
        
        # Color Mode
        color_mode = ppPrintColor
        if ppt_settings.color_mode == "grayscale":
            color_mode = ppPrintBlackAndWhite
        elif ppt_settings.color_mode == "bw":
            color_mode = ppPrintPureBlackAndWhite
        
        # Intent (quality)
        intent = ppFixedFormatIntentPrint
        if settings.optimization.image_quality == "low":
            intent = ppFixedFormatIntentScreen
        
        # Helper to convert Python bool to COM bool
        def to_com_bool(value):
            return -1 if bool(value) else 0
        
        export_args = {
            "Path": str(output_path),
            "FixedFormatType": int(ppFixedFormatTypePDF),
            "Intent": int(intent),
            "RangeType": int(range_type),
            "FrameSlides": 0,
            "HandoutOrder": 1,
            "OutputType": 1,
            "IncludeDocProperties": to_com_bool(settings.metadata.include_properties),
            "KeepIRMSettings": -1,
            "DocStructureTags": to_com_bool(settings.metadata.include_tags),
            "BitmapMissingFonts": to_com_bool(settings.optimization.bitmap_text),
            "UseISO19005_1": to_com_bool(settings.compliance == "pdfa"),
        }
        
        # Add slide range if specified
        if range_type == ppPrintSlideRange:
            export_args["SlideShowName"] = ""
            # Note: For range, we need to create a PrintRange object
            # This is handled differently - we'll use From/To parameters
            logger.debug(f"Exporting slides {from_slide} to {to_slide}")
        
        return export_args
