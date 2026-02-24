import sys
from pathlib import Path

# Add project root to python path to allow correct module execution
root_path = Path(__file__).parent.parent
sys.path.insert(0, str(root_path))

from src.cli import app

if __name__ == "__main__":
    app()
