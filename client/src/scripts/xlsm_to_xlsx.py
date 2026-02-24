"""
XLSM to XLSX Converter

Converts all .xlsm files from an input folder to .xlsx format
in an output folder, preserving the directory structure.

Usage:
    python -m src.scripts.xlsm_to_xlsx <input_folder> <output_folder>
"""

import sys
import shutil
from pathlib import Path

from openpyxl import load_workbook
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

console = Console()


def convert_xlsm_to_xlsx(input_path: Path, output_path: Path) -> None:
    """
    Convert a single .xlsm file to .xlsx by loading and re-saving
    without macros.

    Args:
        input_path: Path to the source .xlsm file.
        output_path: Path to the destination .xlsx file.
    """
    wb = load_workbook(str(input_path), keep_vba=False)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(str(output_path))
    wb.close()


def batch_convert(input_folder: Path, output_folder: Path) -> None:
    """
    Recursively find all .xlsm files in input_folder and convert
    them to .xlsx in output_folder, preserving directory structure.

    Args:
        input_folder: Root folder containing .xlsm files.
        output_folder: Root folder for converted .xlsx files.
    """
    xlsm_files = sorted(input_folder.rglob("*.xlsm"))

    if not xlsm_files:
        console.print("[yellow]No .xlsm files found in the input folder.[/yellow]")
        return

    console.print(f"[bold cyan]Found {len(xlsm_files)} .xlsm file(s) to convert.[/bold cyan]\n")

    success_count = 0
    fail_count = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Converting...", total=len(xlsm_files))

        for xlsm_file in xlsm_files:
            relative = xlsm_file.relative_to(input_folder)
            xlsx_name = relative.with_suffix(".xlsx")
            dest = output_folder / xlsx_name

            progress.update(task, description=f"[cyan]{relative.name}[/cyan]")

            try:
                convert_xlsm_to_xlsx(xlsm_file, dest)
                success_count += 1
            except Exception as e:
                fail_count += 1
                console.print(f"  [red]✗ {relative} — {e}[/red]")

            progress.advance(task)

    console.print()
    console.print(f"[bold green]✓ {success_count} converted[/bold green]", end="")
    if fail_count:
        console.print(f"  [bold red]✗ {fail_count} failed[/bold red]")
    else:
        console.print()


def main() -> None:
    if len(sys.argv) != 3:
        console.print("[bold]Usage:[/bold] python -m src.scripts.xlsm_to_xlsx <input_folder> <output_folder>")
        sys.exit(1)

    input_folder = Path(sys.argv[1]).resolve()
    output_folder = Path(sys.argv[2]).resolve()

    if not input_folder.is_dir():
        console.print(f"[red]Input folder does not exist: {input_folder}[/red]")
        sys.exit(1)

    output_folder.mkdir(parents=True, exist_ok=True)

    console.print(f"[bold]Input:[/bold]  {input_folder}")
    console.print(f"[bold]Output:[/bold] {output_folder}\n")

    batch_convert(input_folder, output_folder)


if __name__ == "__main__":
    main()
