
from rich.progress import Progress, MofNCompleteColumn, TaskProgressColumn
import time

def test_progress():
    progress = Progress(
        TaskProgressColumn(),
        MofNCompleteColumn(),
    )

    with progress:
        task = progress.add_task("Testing", total=6)
        
        # Simulate 4 files done perfectly
        progress.advance(task, 4)
        time.sleep(1)
        
        # Simulate 5th file (Excel?) overshooting?
        # Say it advances 1.9
        progress.advance(task, 1.99)
        time.sleep(1)
        
        # Now completed is 5.99
        # Total is 6
        # Expected: 5/6 and 100%?
        
test_progress()
