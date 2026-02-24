"""
Timeout utilities for long-running operations.

Provides timeout decorators and wrappers to prevent operations from hanging indefinitely.
"""
import threading
import functools
from typing import Any, Callable, Optional, TypeVar
from .logger import logger


class TimeoutError(Exception):
    """Exception raised when an operation times out."""
    pass


T = TypeVar('T')


def run_with_timeout(
    func: Callable[..., T], 
    timeout_seconds: Optional[int], 
    *args, 
    **kwargs
) -> T:
    """
    Run a function with a timeout.
    
    Args:
        func: The function to run
        timeout_seconds: Maximum time to wait in seconds. If None or 0, no timeout is applied.
        *args: Positional arguments for the function
        **kwargs: Keyword arguments for the function
        
    Returns:
        The function's return value
        
    Raises:
        TimeoutError: If the function doesn't complete within the timeout
        Any exception raised by the function
    """
    # If timeout is disabled (None or 0), just run normally
    if not timeout_seconds or timeout_seconds <= 0:
        return func(*args, **kwargs)
    
    result = [None]
    exception = [None]
    
    def target():
        try:
            result[0] = func(*args, **kwargs)
        except Exception as e:
            exception[0] = e
    
    thread = threading.Thread(target=target)
    thread.daemon = True
    thread.start()
    thread.join(timeout_seconds)
    
    if thread.is_alive():
        # Thread is still running - timeout occurred
        # Note: We cannot forcibly kill the thread in Python, but we can abandon it
        logger.error(f"Operation timed out after {timeout_seconds} seconds")
        raise TimeoutError(f"Operation exceeded timeout of {timeout_seconds} seconds")
    
    # Check if an exception occurred
    if exception[0] is not None:
        raise exception[0]
    
    return result[0]


def timeout_decorator(timeout_seconds: Optional[int]):
    """
    Decorator to add timeout to a function.
    
    Args:
        timeout_seconds: Maximum time to wait in seconds. If None or 0, no timeout is applied.
        
    Example:
        @timeout_decorator(300)
        def long_running_task():
            # Do something
            pass
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            return run_with_timeout(func, timeout_seconds, *args, **kwargs)
        return wrapper
    return decorator
