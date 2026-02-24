import threading
import subprocess
from typing import Set, Any
from .logger import logger

# Office process names to kill before conversion
OFFICE_PROCESSES = ["EXCEL.EXE", "WINWORD.EXE", "POWERPNT.EXE"]


def kill_office_processes() -> int:
    """
    Force kill all running Microsoft Office processes before conversion.
    
    Returns:
        Number of processes killed.
    """
    killed_count = 0
    
    for process_name in OFFICE_PROCESSES:
        try:
            # Use taskkill to force terminate the process
            result = subprocess.run(
                ["taskkill", "/F", "/IM", process_name],
                capture_output=True,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            
            if result.returncode == 0:
                killed_count += 1
                logger.info(f"Terminated process: {process_name}")
            elif "not found" not in result.stderr.lower() and "no tasks" not in result.stdout.lower():
                # Only log if it's an actual error, not just "process not running"
                logger.debug(f"Process {process_name} not running or already terminated")
                
        except Exception as e:
            logger.warning(f"Failed to kill {process_name}: {e}")
    
    if killed_count > 0:
        logger.info(f"Killed {killed_count} Office process(es) before conversion")
    
    return killed_count


class ProcessRegistry:
    """
    Global registry for tracking active COM process instances (Excel, Word, PowerPoint)
    to ensure they are closed gracefully on application exit or interrupt.
    """
    _instances: list[Any] = []
    _lock = threading.Lock()

    @classmethod
    def register(cls, instance: Any) -> None:
        """Register a COM instance."""
        with cls._lock:
            if instance not in cls._instances:
                cls._instances.append(instance)
                logger.debug(f"Registered process instance: {instance}")

    @classmethod
    def unregister(cls, instance: Any) -> None:
        """Unregister a COM instance."""
        with cls._lock:
            if instance in cls._instances:
                cls._instances.remove(instance)
                logger.debug(f"Unregistered process instance: {instance}")

    @classmethod
    def kill_all(cls) -> None:
        """
        Force close all registered instances with timeout protection.
        Safe to call from signal handlers or atexit.
        """
        QUIT_TIMEOUT = 5  # seconds per instance
        
        with cls._lock:
            if not cls._instances:
                return
                
            logger.info(f"Cleaning up {len(cls._instances)} active office processes...")
            
            for instance in list(cls._instances):
                # Use timeout to prevent hanging on unresponsive COM objects
                def quit_instance(inst):
                    try:
                        # Try to suppress any dialogs before quitting
                        try:
                            inst.DisplayAlerts = False
                        except:
                            pass
                        
                        # Generic COM Quit() method
                        try:
                            inst.Quit()
                        except AttributeError:
                            # Some objects might accept Close() instead
                            inst.Close()
                            
                        logger.debug(f"Closed process instance: {inst}")
                    except Exception as e:
                        logger.warning(f"Failed to close process instance during cleanup: {e}")
                
                # Run quit with timeout
                thread = threading.Thread(target=quit_instance, args=(instance,))
                thread.daemon = True
                thread.start()
                thread.join(QUIT_TIMEOUT)
                
                if thread.is_alive():
                    logger.warning(f"Process cleanup timed out after {QUIT_TIMEOUT}s - process may need manual termination")
            
            cls._instances.clear()
