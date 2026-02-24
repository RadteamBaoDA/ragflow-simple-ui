import typer
import sys
import time
import shutil
import threading
import msvcrt
import atexit
from .utils.process_manager import ProcessRegistry, kill_office_processes
from .utils.timeout import run_with_timeout, TimeoutError
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Tuple, Dict
# pythoncom needed for COM in threads
import pythoncom
from rich.console import Console
from rich.panel import Panel
from rich.progress import (
    Progress, SpinnerColumn, TextColumn, BarColumn, 
    TaskProgressColumn, TimeElapsedColumn, TimeRemainingColumn,
    MofNCompleteColumn
)
from rich.logging import RichHandler
from rich.layout import Layout
from rich.live import Live
from rich.table import Table
from rich.text import Text

from .version import __version__
from .core.word_converter import WordConverter
from .core.powerpoint_converter import PowerPointConverter
from .core.excel_converter import ExcelConverter
from .core.pdf_processor import PDFProcessor
from .utils.logger import setup_logger, logger
from .config import (
    get_logging_config, get_pdf_settings, get_suffix_config, 
    get_reporting_config, get_post_processing_config, get_pdf_handling_config, 
    get_timeout_config, FileType,
    set_config_path, get_config_path
)


class RealtimeReportWriter:
    """
    Writes conversion reports in realtime.
    - Errors are written immediately when they occur
    - Successful files are tracked and written as they complete
    """
    
    def __init__(self, reports_dir: Path, input_path: Path, output_path: Path, timestamp: str):
        self.reports_dir = reports_dir
        self.input_path = input_path
        self.output_path = output_path
        self.timestamp = timestamp
        self.error_count = 0
        self.success_count = 0
        self.skipped_count = 0
        self._lock = threading.Lock()
        
        # Create reports directory
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize report files with headers
        self._init_error_report()
        self._init_summary_report()
    
    def _init_error_report(self):
        """Initialize error report file with header."""
        self.error_path = self.reports_dir / f"error_{self.timestamp}.txt"
        with open(self.error_path, "w", encoding="utf-8") as f:
            f.write(f"doc2pdf Error Report (Realtime)\n")
            f.write(f"{'='*50}\n")
            f.write(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Input: {self.input_path}\n")
            f.write(f"Output: {self.output_path}\n\n")
            f.write(f"Errors:\n")
            f.write(f"{'-'*50}\n")
    
    def _init_summary_report(self):
        """Initialize summary report file with header."""
        self.summary_path = self.reports_dir / f"summary_{self.timestamp}.txt"
        with open(self.summary_path, "w", encoding="utf-8") as f:
            f.write(f"doc2pdf Conversion Summary (Realtime)\n")
            f.write(f"{'='*50}\n")
            f.write(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Input: {self.input_path}\n")
            f.write(f"Output: {self.output_path}\n\n")
            f.write(f"Successfully Converted Files:\n")
            f.write(f"{'-'*50}\n")
    
    def write_error(self, input_file: Path, output_file: Path, error_msg: str):
        """Write an error entry immediately to the error report."""
        with self._lock:
            self.error_count += 1
            with open(self.error_path, "a", encoding="utf-8") as f:
                f.write(f"\n[{self.error_count}] {input_file.name}\n")
                f.write(f"    Time:   {datetime.now().strftime('%H:%M:%S')}\n")
                f.write(f"    Input:  {input_file}\n")
                f.write(f"    Output: {output_file}\n")
                f.write(f"    Error:  {error_msg}\n")
    
    def write_success(self, input_file: Path, output_file: Path, file_type: str):
        """Write a success entry immediately to the summary report."""
        with self._lock:
            self.success_count += 1
            with open(self.summary_path, "a", encoding="utf-8") as f:
                f.write(f"[{self.success_count}] {input_file.name}\n")
                f.write(f"    Time:   {datetime.now().strftime('%H:%M:%S')}\n")
                f.write(f"    Type:   {file_type}\n")
                f.write(f"    Input:  {input_file}\n")
                f.write(f"    Output: {output_file}\n\n")
    
    def write_skipped(self, input_file: Path, reason: str):
        """Track skipped file."""
        with self._lock:
            self.skipped_count += 1
    
    def finalize(self, total_files: int):
        """Write final summary statistics to both reports."""
        end_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Finalize summary report
        with open(self.summary_path, "a", encoding="utf-8") as f:
            f.write(f"\n{'-'*50}\n")
            f.write(f"Completed: {end_time}\n\n")
            f.write(f"Final Results:\n")
            f.write(f"  Success: {self.success_count}\n")
            f.write(f"  Failed:  {self.error_count}\n")
            f.write(f"  Skipped: {self.skipped_count}\n")
            f.write(f"  Total:   {total_files}\n")
        
        # Finalize error report
        with open(self.error_path, "a", encoding="utf-8") as f:
            f.write(f"\n{'-'*50}\n")
            f.write(f"Completed: {end_time}\n")
            f.write(f"Total Errors: {self.error_count}\n")
        
        # Remove error report if no errors occurred
        if self.error_count == 0:
            try:
                self.error_path.unlink()
            except:
                pass
            return None
        
        return self.error_path

app = typer.Typer(
    name="doc2pdf",
    help="""
    [bold]doc2pdf[/bold] - Convert Microsoft Office documents to PDF.
    
    [bold]Features:[/bold]
    - Batch conversion of folders
    - Support for Word, Excel, and PowerPoint (Configuration)
    - Configurable settings via pattern matching
    - Detailed logging to file and console
    
    [bold]Logging:[/bold]
    Logs are written to the console and to files in the `logs/` directory.
    Check `config.yml` for log rotation settings.
    """,
    add_completion=False,
)
console = Console()



def version_callback(value: bool):
    if value:
        console.print(f"[bold green]doc2pdf[/bold green] version: {__version__}")
        raise typer.Exit()

@app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    version: Optional[bool] = typer.Option(
        None,
        "--version",
        "-v",
        help="Show the application version and exit.",
        callback=version_callback,
        is_eager=True,
    ),
):
    """
    doc2pdf - Convert your documents to PDF with ease.
    """
    if ctx.invoked_subcommand is None:
        console.print(ctx.get_help())

def get_files(path: Path) -> List[Path]:
    if path.is_file():
        return [path]
    
    extensions = {
        "*.docx", "*.doc", 
        "*.xlsx", "*.xls", "*.xlsm", "*.xlsb",
        "*.pptx", "*.ppt",
        "*.pdf"
    }
    
    files = []
    for ext in extensions:
        files.extend(list(path.rglob(ext)))
    return sorted(files)

def get_file_type(path: Path) -> FileType:
    ext = path.suffix.lower()
    if ext in [".docx", ".doc"]:
        return "word"
    elif ext in [".xlsx", ".xls", ".xlsm", ".xlsb"]:
        return "excel"
    elif ext in [".pptx", ".ppt"]:
        return "powerpoint"
    elif ext == ".pdf":
        return "pdf"
    return "word" # Default fallback

@app.command()
def convert(
    input_path: Path = typer.Argument(Path("input"), help="Path to the input file or directory", exists=True),
    output_path: Optional[Path] = typer.Option(Path("output"), "--output", "-o", help="Path to the output PDF or Directory"),
    config_path: Optional[Path] = typer.Option(None, "--config", "-c", help="Path to configuration file", exists=True, dir_okay=False),
    verbose: bool = typer.Option(False, "--verbose", help="Enable verbose logging"),
    trim: Optional[bool] = typer.Option(None, "--trim/--no-trim", help="Trim whitespace from output PDF (overrides config.yml)"),
    trim_margin: Optional[float] = typer.Option(None, "--trim-margin", help="Margin in points when trimming (default: 10)"),
):
    """
    Convert a document or a directory of documents to PDF.
    
    Defaults:
    - Input: ./input
    - Output: ./output
    
    Supports Word (.doc, .docx), Excel (.xls, .xlsx), and PowerPoint (.ppt, .pptx).
    """
    # Register cleanup on exit
    atexit.register(ProcessRegistry.kill_all)
    
    # Configure config path if provided
    if config_path:
        set_config_path(config_path)

    # Load config (refresh in case path changed)
    config = get_logging_config()


    # Configure verbose logging
    current_config = config.copy()
    if verbose:
        current_config["level"] = "DEBUG"
    
    # Capture console handler ID to remove it later during TUI to prevent flashing
    console_handler_id = setup_logger(current_config)

    # Log config path
    logger.info(f"Using configuration file: {get_config_path().resolve()}")

    # Kill any existing Office processes before starting
    kill_office_processes()

    files = get_files(input_path)
    
    if not files:
        console.print(f"[yellow]No supported Office documents found in {input_path}.[/yellow]")
        raise typer.Exit()

    # Initialize converters
    word_converter = WordConverter()
    ppt_converter = PowerPointConverter()
    excel_converter = ExcelConverter()
    
    # Get post-processing settings (CLI overrides config)
    post_proc_config = get_post_processing_config()
    should_trim = trim if trim is not None else post_proc_config.trim_whitespace.enabled
    trim_margin_value = trim_margin if trim_margin is not None else post_proc_config.trim_whitespace.margin
    
    # Get timeout settings
    timeout_config = get_timeout_config()
    document_timeout = timeout_config.document_parsing
    excel_trim_timeout = timeout_config.excel_trim

    # TUI Setup
    from .tui import LogBuffer, TUIContext
    
    log_buffer = LogBuffer()
    tui_ctx = TUIContext(log_buffer)
    
    # Variable to hold Live context reference for sink
    live_context = None
    
    # Redirect Logger to TUI Buffer
    def tui_sink(message):
        record = message.record
        level_name = record['level'].name
        colors = { "INFO": "green", "WARNING": "yellow", "ERROR": "bold red", "CRITICAL": "bold white on red", "DEBUG": "cyan" }
        color = colors.get(level_name, "white")
        log_msg = f"[{color}]{record['time'].strftime('%H:%M:%S')} | {level_name: <8} | {record['message']}[/{color}]"
        log_buffer.write(log_msg)
        tui_ctx.update_logs()
        # Force immediate refresh if Live context is available
        if live_context is not None:
            try:
                live_context.refresh()
            except Exception:
                pass
    
    try:
        tui_level = current_config.get("level", "INFO")
        logger.add(tui_sink, format="{message}", level=tui_level)
        if console_handler_id is not None:
            logger.remove(console_handler_id)
    except Exception:
        pass

    # Initialize Progress (passive)
    progress = Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        TimeRemainingColumn(),
        expand=True
    )

    # Define worker function for threading
    def conversion_worker():
        # COM initialization for thread
        pythoncom.CoInitialize()
        try:
            # Initialize converters inside thread to ensure COM affinity
            word_converter = WordConverter()
            ppt_converter = PowerPointConverter()
            excel_converter = ExcelConverter()
            pdf_processor = PDFProcessor()
            
            nonlocal success_count, fail_count, skipped_count
            
            for file_path in files:
                file_type = get_file_type(file_path)
                progress.update(task_id, description=f"[cyan]Converting ({file_type}): {file_path.name}")
                # Note: tui_ctx.update_progress is called by main loop or here? 
                # Ideally main loop updates TUI. 
                # But we need real-time log updates.
                # logs trigger update_logs automatically now via sink.
                # We should update progress here too? 
                # No, main loop refreshes Live context. 
                # But if we want instant feedback on "Converting..." text change, we can force update.
                tui_ctx.update_progress(progress)
                
                # Get settings
                # base_path is the root input directory (either a folder or file's parent)
                base_path = input_path if input_path.is_dir() else input_path.parent
                settings = get_pdf_settings(input_path=file_path, file_type=file_type, base_path=base_path)
                suffix_config = get_suffix_config()
                suffix = suffix_config.get(file_type, "")
                
                # Determine output
                if output_path:
                    if input_path.is_dir():
                        rel_path = file_path.relative_to(input_path)
                        base_name = rel_path.stem + suffix + ".pdf"
                        target_file = output_path / rel_path.parent / base_name
                        target_file.parent.mkdir(parents=True, exist_ok=True)
                    else:
                        if output_path.suffix.lower() == ".pdf":
                            target_file = output_path
                        else:
                            base_name = file_path.stem + suffix + ".pdf"
                            target_file = output_path / base_name
                            target_file.parent.mkdir(parents=True, exist_ok=True)
                else:
                    target_file = None 

                try:
                    def progress_callback(amount: float):
                        # Only update TUI display, don't advance progress bar
                        # Progress bar advances by 1 per file after conversion completes
                        tui_ctx.update_progress(progress)
                    
                    converted_pdf = None
                    
                    if file_type == "word":
                        run_with_timeout(
                            word_converter.convert,
                            document_timeout,
                            file_path, target_file, settings, base_path=base_path
                        )
                        converted_pdf = target_file
                        success_count += 1
                        if report_writer:
                            report_writer.write_success(file_path, target_file, file_type)
                        progress.advance(task_id, advance=1)
                    elif file_type == "powerpoint":
                        run_with_timeout(
                            ppt_converter.convert,
                            document_timeout,
                            file_path, target_file, settings, base_path=base_path
                        )
                        converted_pdf = target_file
                        success_count += 1
                        if report_writer:
                            report_writer.write_success(file_path, target_file, file_type)
                        progress.advance(task_id, advance=1)
                    elif file_type == "excel":
                        run_with_timeout(
                            excel_converter.convert,
                            document_timeout,
                            file_path, target_file, settings, on_progress=progress_callback, base_path=base_path
                        )
                        converted_pdf = target_file
                        success_count += 1
                        if report_writer:
                            report_writer.write_success(file_path, target_file, file_type)
                        progress.advance(task_id, advance=1)
                    elif file_type == "pdf":
                        # Log full path
                        logger.info(f"Input PDF found: {file_path}")
                        
                        pdf_handling = get_pdf_handling_config()
                        if pdf_handling.copy_to_output and target_file:
                             # Logic to copy
                             shutil.copy2(file_path, target_file)
                             logger.info(f"Copied PDF to: {target_file}")
                             converted_pdf = target_file
                             success_count += 1
                             if report_writer:
                                 report_writer.write_success(file_path, target_file, file_type)
                        else:
                             # Just skip or count as success? 
                             # If we don't copy, we essentially "skipped" processing it, but it was "handled".
                             # But let's count as skipped if not copied, or success if we just wanted to log it?
                             # Requirement: "when input have pdf, write input full path of this pdf file."
                             # So we always do that.
                             # If copy is disabled, we effectively did nothing else.
                             # Let's count as skipped-by-policy or success? 
                             # Let's count as success because we "handled" it as per config (logging).
                             # But "skipped" might be more valuable for user stats.
                             if not pdf_handling.copy_to_output:
                                 logger.debug(f"PDF copy disabled. Skipping copy for {file_path.name}")
                                 skipped_count += 1
                                 if report_writer:
                                     report_writer.write_skipped(file_path, "PDF copy disabled")
                             else:
                                 # This branch is for when target_file is None (dry run?) or copy succeeded
                                 pass 

                        progress.advance(task_id, advance=1)
                    else:
                        logger.warning(f"Conversion for {file_type} not supported. Skipping {file_path.name}")
                        skipped_count += 1
                        if report_writer:
                            report_writer.write_skipped(file_path, f"File type '{file_type}' not supported")
                        progress.advance(task_id, advance=1)
                    
                    if converted_pdf and should_trim and converted_pdf.exists():
                        # Check if file type is included in trim settings
                        if file_type in post_proc_config.trim_whitespace.include:
                            try:
                                # Apply timeout specifically for Excel trimming
                                trim_timeout = excel_trim_timeout if file_type == "excel" else None
                                run_with_timeout(
                                    pdf_processor.trim_whitespace,
                                    trim_timeout,
                                    converted_pdf, margin=trim_margin_value
                                )
                            except TimeoutError as timeout_err:
                                logger.error(f"Trimming timed out for {converted_pdf.name}: {timeout_err}")
                            except Exception as trim_err:
                                logger.warning(f"Failed to trim whitespace from {converted_pdf.name}: {trim_err}")
                        else:
                            logger.debug(f"Skipping trim for {file_type} file: {file_path.name}")
                        
                except TimeoutError as timeout_err:
                    # Thread-safe counter update
                    fail_count += 1
                    error_msg = f"Conversion timed out: {timeout_err}"
                    failed_files.append((file_path, target_file, error_msg))
                    logger.error(f"Failed to convert {file_path.name}: {error_msg}")
                    # Write error to report immediately
                    if report_writer:
                        report_writer.write_error(file_path, target_file, error_msg)
                    progress.advance(task_id, advance=1)
                except Exception as e:
                    # Thread-safe counter update
                    fail_count += 1
                    failed_files.append((file_path, target_file, str(e)))
                    logger.error(f"Failed to convert {file_path}: {e}")
                    # Write error to report immediately
                    if report_writer:
                        report_writer.write_error(file_path, target_file, str(e))
                    progress.advance(task_id, advance=1)
                
                tui_ctx.update_progress(progress)

        finally:
            pythoncom.CoUninitialize()

    # Initialize realtime report writer
    reporting_config = get_reporting_config()
    report_writer = None
    if reporting_config.enabled:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        reports_dir = Path(reporting_config.reports_dir)
        report_writer = RealtimeReportWriter(reports_dir, input_path, output_path, timestamp)
    
    try:
        with Live(tui_ctx.layout, refresh_per_second=10, screen=True) as live:
            # Store live context for sink
            live_context = live
            
            task_id = progress.add_task(f"[cyan]Converting {len(files)} files...", total=len(files))
            
            success_count = 0
            fail_count = 0
            skipped_count = 0
            failed_files: List[Tuple[Path, Path, str]] = []  # (input, output, error)
            
            tui_ctx.update_progress(progress)
            
            # Start Worker Thread
            worker_thread = threading.Thread(target=conversion_worker, daemon=True)
            worker_thread.start()
            
            # Main Loop: Handle Inputs and TUI Refresh
            while worker_thread.is_alive():
                # Check for key press (Windows only)
                if msvcrt.kbhit():
                    key = msvcrt.getch()
                    if key == b'\xe0': # Special key prefix
                        code = msvcrt.getch()
                        if code == b'H': # Up Arrow
                             log_buffer.scroll_up()
                             tui_ctx.update_logs()
                        elif code == b'P': # Down Arrow
                             log_buffer.scroll_down()
                             tui_ctx.update_logs()
                
                # Small sleep to prevent CPU spinning
                time.sleep(0.05)
                # live.refresh() # handled by refresh_per_second, but explicit update helps responsiveness
            
            # Thread finished
            worker_thread.join()

    except KeyboardInterrupt:
        logger.warning("Conversion cancelled by user.")
        ProcessRegistry.kill_all()
        console.print("[bold red]Conversion cancelled by user.[/bold red]")
        sys.exit(130)
            
    # Remove TUI Sink cleanup (optional, but good practice)
    # logger.remove(sink_id) # Hard to get ID without return value from add.
    
    # Summary
    # Check if console is safe to clear (might have been closed by Live context exit)
    # Live context restores terminal.
    console.clear() 
    console.print(Panel(Text(" Conversion Completed ", style="bold green"), style="green"))

    table = Table(title="Conversion Summary")
    table.add_column("Status", style="bold")
    table.add_column("Count")
    
    table.add_row("[green]Success[/green]", str(success_count))
    table.add_row("[red]Failed[/red]", str(fail_count))
    table.add_row("[yellow]Skipped[/yellow]", str(skipped_count))
    table.add_row("Total", str(len(files)))
    
    console.print(table)
    console.print(f"Logs available in: [bold]{current_config['file'].get('path', 'logs/')}[/bold]")
    
    # Finalize realtime reports
    if report_writer:
        report_writer.finalize(len(files))
        console.print(f"Summary report: [bold]{report_writer.summary_path}[/bold]")
        if report_writer.error_count > 0:
            console.print(f"Error report: [bold]{report_writer.error_path}[/bold]")
    
    # Copy error files to separate folder (preserving input folder structure)
    if reporting_config.enabled and reporting_config.copy_error_files.enabled and failed_files:
        errors_dir = output_path / reporting_config.copy_error_files.target_dir
        errors_dir.mkdir(parents=True, exist_ok=True)
        for input_file, _, _ in failed_files:
            try:
                # Preserve folder structure relative to input_path
                if input_path.is_dir():
                    rel_path = input_file.relative_to(input_path)
                    dest = errors_dir / rel_path
                    dest.parent.mkdir(parents=True, exist_ok=True)
                else:
                    dest = errors_dir / input_file.name
                shutil.copy2(input_file, dest)
            except Exception as copy_err:
                logger.warning(f"Could not copy error file {input_file.name}: {copy_err}")
        console.print(f"Error files copied to: [bold]{errors_dir}[/bold]")
    
if __name__ == "__main__":
    app()
