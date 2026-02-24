import sys
from loguru import logger
from pathlib import Path
from typing import Optional

def setup_logger(config: Optional[dict] = None) -> Optional[int]:
    """
    Configure the application logger using loguru.
    
    Args:
        config: Logging configuration dictionary
    """
    # Remove default handler
    logger.remove()
    
    # Improve visibility for DEBUG on black backgrounds (default blue is too dark)
    logger.level("DEBUG", color="<cyan>")

    
    if config is None:
        # Fallback default
        logger.add(sys.stderr, level="INFO")
        return

    level = config.get("level", "INFO")
    
    console_handler_id = None
    # Console Handler
    if config.get("console", True):
        console_handler_id = logger.add(
            sys.stderr, 
            level=config.get("level", "INFO"), # Use the general level for console if not specified otherwise
            format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>"
        )
    


    # File Handler
    file_config = config.get("file", {})
    if file_config.get("enabled", False):
        path = file_config.get("path", "logs/doc2pdf_{time}.log")
        rotation = file_config.get("rotation", "10 MB")
        retention = file_config.get("retention", "10 days")
        
        # Ensure log directory exists
        log_path = Path(path)
        # Handle the case where path might contain loguru templates like {time}
        # We can't easily resolve the parent if it has templates, but assuming standard "logs/..." structure:
        # If the path is relative and starts with a directory, try to create it.
        # However, loguru handles directory creation automatically if permissions allow.
        # But specifically for the path *template*, loguru needs the directory to existing for the *rotation* check mostly, 
        # actually loguru creates directories on the fly.
        
        logger.add(
            path,
            rotation=rotation,
            retention=retention,
            level=level,
        )

    return console_handler_id

