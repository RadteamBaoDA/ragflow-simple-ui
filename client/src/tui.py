from collections import deque
from datetime import datetime
from typing import Optional

from rich.console import RenderableType, Group
from rich.layout import Layout
from rich.panel import Panel
from rich.text import Text
from rich.align import Align
from rich.table import Table
from rich import box

class LogBuffer:
    """Captures logs for display in the TUI."""
    def __init__(self, maxlen=1000): # Increased buffer
        self.queue = deque(maxlen=maxlen)
        self.scroll_offset = 0
        self.view_height = 20 # Approximate view height, adjustable
    
    def write(self, message: str):
        if message.strip():
             self.queue.append(message.strip())
             # Auto-scroll if at bottom (offset 0)
             if self.scroll_offset > 0:
                 self.scroll_offset += 1

    def scroll_up(self):
        """Scroll up (view older logs)."""
        if self.scroll_offset < len(self.queue) - self.view_height:
            self.scroll_offset += 1

    def scroll_down(self):
        """Scroll down (view newer logs)."""
        if self.scroll_offset > 0:
            self.scroll_offset -= 1

    def get_renderable(self) -> RenderableType:
        # Calculate slice
        total = len(self.queue)
        if total == 0:
            text = ""
        else:
            if self.scroll_offset == 0:
                # Show latest
                visible = list(self.queue)[-self.view_height:]
            else:
                # Show history
                end = total - self.scroll_offset
                start = max(0, end - self.view_height)
                visible = list(self.queue)[start:end]
            text = "\n".join(visible)
            
        return Panel(
            Text.from_markup(text),
            title=f"Application Logs {'(SCROLLED)' if self.scroll_offset > 0 else ''}",
            border_style="blue",
            box=box.ROUNDED
        )

def make_layout() -> Layout:
    """Create the main TUI layout."""
    layout = Layout()
    layout.split(
        Layout(name="header", size=4),
        Layout(name="main")
    )
    layout["main"].split_column(
        Layout(name="progress", size=6),
        Layout(name="logs") # Logs take remaining space
    )
    return layout

def get_header() -> RenderableType:
    """Create the header panel."""
    # Using a simple text banner since we can't easily display images
    grid = Table.grid(expand=True)
    grid.add_column(justify="left", ratio=1)
    grid.add_column(justify="right")
    
    title = Text(" DOC2PDF CONVERTER ", style="bold white on blue")
    meta = Text(f" {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ", style="dim")
    
    grid.add_row(title, meta)
    
    return Panel(
        grid,
        style="white on blue",
        box=box.HEAVY
    )

class TUIContext:
    """Context manager helper for TUI state."""
    def __init__(self, log_buffer: LogBuffer):
        self.log_buffer = log_buffer
        self.layout = make_layout()
        self.layout["header"].update(get_header())
        self.layout["logs"].update(log_buffer.get_renderable())

    def update_progress(self, renderable: RenderableType):
        self.layout["progress"].update(Panel(renderable, title="Progress", border_style="green", box=box.ROUNDED))
        
    def update_logs(self):
        self.layout["logs"].update(self.log_buffer.get_renderable())
        self.layout["header"].update(get_header()) # Update time
