# Changelog

## [0.1.0] - 2026-01-09

### Added
- **Word Conversion**: Initial support for converting Microsoft Word documents (`.doc`, `.docx`) to PDF using `pywin32` COM automation.
- **Batch Processing**: CLI command `doc2pdf convert` supports batch processing of entire directories recursively.
- **TUI Progress**: Rich terminal UI with progress bars, status spinners, and conversion summary tables.
- **Dual Logging**: Integrated logging to both console (TUI-friendly) and rotated log files in `logs/` directory.
- **Configuration System**:
  - `config.yml` configuration file.
  - Granular control over PDF Layout (orientation, margins), Metadata (properties, tags), Bookmarks, and Compliance (PDF/A).
  - **Pattern-Priority Config**: Flexible configuration overrides based on file patterns (e.g., `**/CONFIDENTIAL/**`) with priority ranking.
  - Multi-type support structure (Word, Excel, PowerPoint) - *Note: Excel and PowerPoint converters are currently placeholders.*
- **Defaults**:
  - Default Input Directory: `./input`
  - Default Output Directory: `./output`

### Changed
- Refactored `src` layout to separate core logic, configuration, and utilities.
- Centralized version management in `src/version.py`.
