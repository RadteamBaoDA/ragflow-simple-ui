"""
Converter Config — loads and manages per-category/version conversion settings.

Configuration is stored in Redis by the backend when a conversion job is enqueued.
Each job can carry a 'config' JSON blob with settings from config.yml merged with
category/version-specific overrides.

Default config mirrors client/config.yml structure:
- post_processing: trim_whitespace (enabled, margin, include types)
- suffix: per-type PDF filename suffixes
- excel: orientation, row_dimensions, metadata_header, shrink thresholds
"""
import json
from dataclasses import dataclass, field
from typing import Optional, List

from src.logger import logger


# ============================================================================
# Config Dataclasses
# ============================================================================

@dataclass
class TrimWhitespaceConfig:
    """PDF whitespace trimming settings."""
    enabled: bool = True
    margin: float = 10.0
    include: List[str] = field(default_factory=lambda: ['excel'])


@dataclass
class PostProcessingConfig:
    """PDF post-processing settings."""
    trim_whitespace: TrimWhitespaceConfig = field(
        default_factory=TrimWhitespaceConfig
    )
    remove_empty_pages: bool = True


@dataclass
class SuffixConfig:
    """PDF filename suffix per document type."""
    word: str = '_d'
    powerpoint: str = '_p'
    excel: str = '_x'


@dataclass
class ExcelConfig:
    """Excel-specific conversion settings."""
    orientation: str = 'landscape'
    row_dimensions: Optional[int] = 10
    metadata_header: bool = True
    min_shrink_factor: float = 0.3
    ocr_sheet_name_label: bool = True
    oversized_action: str = 'skip'
    is_write_file_path: bool = False
    page_shrink_threshold: float = 0.10


@dataclass
class ConverterConfig:
    """
    Complete converter configuration.

    Loaded from the conversion job's 'config' field in Redis,
    which is set by the backend based on the document category
    and version settings.
    """
    post_processing: PostProcessingConfig = field(
        default_factory=PostProcessingConfig
    )
    suffix: SuffixConfig = field(default_factory=SuffixConfig)
    excel: ExcelConfig = field(default_factory=ExcelConfig)


# ============================================================================
# Config Loading
# ============================================================================

def load_config_from_job(job_data: dict) -> ConverterConfig:
    """
    Load converter config from a Redis job hash.

    The 'config' field in the job hash is a JSON string containing
    category/version-specific converter settings.

    @param job_data: Job hash from Redis.
    @returns: Parsed ConverterConfig with defaults for missing fields.
    """
    config = ConverterConfig()

    config_json = job_data.get('config', '')
    if not config_json:
        return config

    try:
        data = json.loads(config_json)
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning(f'Invalid config JSON in job, using defaults: {e}')
        return config

    # Parse post_processing
    pp = data.get('post_processing', {})
    if pp:
        tw = pp.get('trim_whitespace', {})
        if tw:
            config.post_processing.trim_whitespace.enabled = tw.get(
                'enabled', config.post_processing.trim_whitespace.enabled
            )
            config.post_processing.trim_whitespace.margin = tw.get(
                'margin', config.post_processing.trim_whitespace.margin
            )
            config.post_processing.trim_whitespace.include = tw.get(
                'include', config.post_processing.trim_whitespace.include
            )
        config.post_processing.remove_empty_pages = pp.get(
            'remove_empty_pages',
            config.post_processing.remove_empty_pages,
        )

    # Parse suffix
    suffix = data.get('suffix', {})
    if suffix:
        config.suffix.word = suffix.get('word', config.suffix.word)
        config.suffix.powerpoint = suffix.get('powerpoint', config.suffix.powerpoint)
        config.suffix.excel = suffix.get('excel', config.suffix.excel)

    # Parse excel settings
    excel = data.get('excel', {})
    if excel:
        config.excel.orientation = excel.get('orientation', config.excel.orientation)
        config.excel.row_dimensions = excel.get(
            'row_dimensions', config.excel.row_dimensions
        )
        config.excel.metadata_header = excel.get(
            'metadata_header', config.excel.metadata_header
        )
        config.excel.min_shrink_factor = excel.get(
            'min_shrink_factor', config.excel.min_shrink_factor
        )
        config.excel.ocr_sheet_name_label = excel.get(
            'ocr_sheet_name_label', config.excel.ocr_sheet_name_label
        )
        config.excel.oversized_action = excel.get(
            'oversized_action', config.excel.oversized_action
        )
        config.excel.is_write_file_path = excel.get(
            'is_write_file_path', config.excel.is_write_file_path
        )
        config.excel.page_shrink_threshold = excel.get(
            'page_shrink_threshold', config.excel.page_shrink_threshold
        )

    logger.debug(f'Loaded converter config: post_processing={pp}, excel={excel}')
    return config


def get_doc_type(filename: str) -> str:
    """
    Determine document type from filename extension.

    @param filename: File name with extension.
    @returns: 'word', 'excel', 'powerpoint', or 'pdf'.
    """
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    word_exts = {'doc', 'docx', 'docm'}
    excel_exts = {'xls', 'xlsx', 'xlsm'}
    ppt_exts = {'ppt', 'pptx', 'pptm'}

    if ext in word_exts:
        return 'word'
    elif ext in excel_exts:
        return 'excel'
    elif ext in ppt_exts:
        return 'powerpoint'
    elif ext == 'pdf':
        return 'pdf'
    return 'unknown'


def should_trim_whitespace(config: ConverterConfig, doc_type: str) -> bool:
    """
    Check if whitespace trimming should be applied for this document type.

    @param config: Converter config.
    @param doc_type: Document type ('word', 'excel', 'powerpoint').
    @returns: True if trimming is enabled and this type is included.
    """
    tw = config.post_processing.trim_whitespace
    return tw.enabled and doc_type in tw.include


def get_pdf_suffix(config: ConverterConfig, doc_type: str) -> str:
    """
    Get the PDF filename suffix for a document type.

    @param config: Converter config.
    @param doc_type: Document type.
    @returns: Suffix string (e.g., '_d' for word).
    """
    suffixes = {
        'word': config.suffix.word,
        'powerpoint': config.suffix.powerpoint,
        'excel': config.suffix.excel,
    }
    return suffixes.get(doc_type, '')
