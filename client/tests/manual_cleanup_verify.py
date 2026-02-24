import sys
import os
from unittest.mock import MagicMock

# Add project root to path
sys.path.append(os.path.abspath("."))

from src.utils.process_manager import ProcessRegistry

def test_registry():
    print("Testing ProcessRegistry...")
    
    # 1. Create Mock COM objects
    mock_app1 = MagicMock()
    mock_app2 = MagicMock()
    
    # 2. Register them
    ProcessRegistry.register(mock_app1)
    ProcessRegistry.register(mock_app2)
    
    # 3. Simulate Kill All
    print("Calling kill_all()...")
    ProcessRegistry.kill_all()
    
    # 4. Verify Quit called
    if mock_app1.Quit.called:
        print("PASS: App1.Quit called")
    else:
        print("FAIL: App1.Quit NOT called")
        sys.exit(1)
        
    if mock_app2.Quit.called:
        print("PASS: App2.Quit called")
    else:
        print("FAIL: App2.Quit NOT called")
        sys.exit(1)
        
    # 5. Verify registry cleared
    if len(ProcessRegistry._instances) == 0:
        print("PASS: Registry cleared")
    else:
        print("FAIL: Registry not cleared")
        sys.exit(1)

if __name__ == "__main__":
    test_registry()
