# Office→PDF Converter Logic Reference

Reference document for porting the existing Windows COM-based converters (`client/src/core/`) to LibreOffice headless on Linux.

---

## Architecture Overview

```
base.py (Converter Protocol)
├── word_converter.py     → WordConverter
├── powerpoint_converter.py → PowerPointConverter  
└── excel_converter.py    → ExcelConverter (most complex)
```

All converters follow the `Converter` protocol:
```python
def convert(input_path: Path, output_path: Path, settings: PDFConversionSettings) -> Path
```

---

## Word Converter Logic

**Source**: [word_converter.py](file:///d:/Project/RAG/ragflow-simple-ui%20-main/client/src/core/word_converter.py)

1. Open document via COM: `word.Documents.Open(ReadOnly=True, ConfirmConversions=False, NoEncodingDialog=True)`
2. Apply page setup: orientation (portrait/landscape), margins (narrow = 0.5")
3. Export: `doc.ExportAsFixedFormat(PDF)` with settings:
   - `OptimizeFor`: Print (high quality) or OnScreen (low quality)
   - `CreateBookmarks`: None, Headings, or Word Bookmarks
   - `IncludeDocProps`, `DocStructureTags`, `BitmapMissingFonts`
   - `UseISO19005_1`: PDF/A compliance

**LibreOffice equivalent**: `libreoffice --headless --convert-to pdf <file>`

---

## PowerPoint Converter Logic

**Source**: [powerpoint_converter.py](file:///d:/Project/RAG/ragflow-simple-ui%20-main/client/src/core/powerpoint_converter.py)

1. Open: `ppt.Presentations.Open(ReadOnly=True, WithWindow=False)`
2. Export: `presentation.SaveAs(output, ppSaveAsPDF=32)`
3. Settings: Color mode (color/grayscale/BW), slide range, intent (Print/Screen)

**LibreOffice equivalent**: `libreoffice --headless --convert-to pdf <file>`

---

## Excel Converter Logic (Complex)

**Source**: [excel_converter.py](file:///d:/Project/RAG/ragflow-simple-ui%20-main/client/src/core/excel_converter.py) — 1941 lines

### Core Flow

1. Open workbook (suppress all dialogs)
2. Get visible sheets to export
3. For each sheet:
   a. Calculate content dimensions
   b. Optionally chunk by row_dimensions
   c. Apply page setup (smart page size)
   d. Apply metadata headers
4. Export selected sheets to PDF

### Content Dimension Calculation (`_get_content_dimensions_points`)

Priority order for determining bounds:

| Priority | Source | Description |
|----------|--------|-------------|
| 1 | PrintArea | User-defined print area (e.g., `$A$1:$Z$100`) |
| 2 | PageBreaks | VPageBreaks (columns) and HPageBreaks (rows) |
| 3 | Cells.Find | Search for last cell with data (`SearchDirection=xlPrevious`) |
| 3b | Text Overflow | Detect text that extends beyond column width using row sampling |

**Text overflow detection**: Samples first 50, last 50, and middle 10 rows. For each cell with text >15 chars, estimates pixel width (`7.2pt/char`), checks if it exceeds column width (accounting for merged cells), and extends bounds.

**Shape expansion**: Iterates all shapes (charts, images), expands bounds to include `shape.Left + shape.Width` and `shape.Top + shape.Height`.

### Smart Page Size Algorithm (`_apply_page_setup`)

**Goal**: Choose the smallest paper size that fits all content columns without horizontal scrolling.

```
Step 1: Try CUSTOM paper size (exact fit)
    → PaperWidth = content_width + 0.5" margin
    → PaperHeight = content_height + 1.5" margin buffer
    → If supported by printer → done

Step 2: Fall back to STANDARD paper catalog
    → Paper catalog (sorted by effective width ascending):
```

| Paper | Width (inches) | Orientation |
|-------|---------------|-------------|
| A4 | 8.27 | Portrait |
| Letter | 8.50 | Portrait |
| Legal | 8.50 | Portrait |
| B4 | 9.84 | Portrait |
| Letter | 11.00 | Landscape |
| Tabloid | 11.00 | Portrait |
| A3 | 11.69 | Portrait |
| A4 | 11.69 | Landscape |
| B4 | 13.90 | Landscape |
| B3 | 13.90 | Portrait |
| Legal | 14.00 | Landscape |
| A2 | 16.54 | Portrait |
| A3 | 16.54 | Landscape |
| Tabloid | 17.00 | Landscape |
| Arch C | 17.00 | Portrait |
| B3 | 19.70 | Landscape |
| Arch D | 22.00 | Portrait |
| Arch C | 22.00 | Landscape |
| A2 | 23.39 | Landscape |
| Arch D | 34.00 | Landscape |
| Arch E | 34.00 | Portrait |
| Arch E | 44.00 | Landscape |

**Selection algorithm**:
1. Filter by configured orientation (landscape/portrait/auto)
2. Find exact candidates (paper_width ≥ content_width)
3. Find shrink candidates (within `page_shrink_threshold`, default 10%)
4. Prefer shrink if it wastes less than exact fit
5. Try setting paper size via COM — printer may reject unsupported sizes
6. Fallback: use largest available paper

### Key Settings → LibreOffice Mappings

| Excel COM Setting | LibreOffice Equivalent |
|---|---|
| `FitToPagesWide = 1` | `-e PageRange=...` or macro-based |
| `FitToPagesTall = N` | Limited support |
| `PaperSize = xlPaperA3` | `--printer-properties "<setPaperSize>8</>"` |
| Custom PaperWidth/Height | LibreOffice calc macros or Python-UNO |
| `Orientation = xlLandscape` | `--printer-properties "(orientation 1)"` |
| Margins | Via macro or Python-UNO bridge |
| Headers/Footers | Via macro or Python-UNO bridge |

### Row Chunking

When `row_dimensions > 0`:
1. Copy sheet N times (one per chunk)
2. Set `PrintArea = $A${start}:${lastCol}${end}` for each chunk
3. Apply page setup to each chunk sheet
4. Export all chunk sheets as one PDF

### LibreOffice Port Strategy

For **standard conversion** (Word, PowerPoint, simple Excel):
```bash
libreoffice --headless --convert-to pdf --outdir /tmp/output /tmp/input/file.xlsx
```

For **advanced Excel** (smart page sizing, full-column export):
Use **Python-UNO bridge** to control LibreOffice programmatically:
```python
import subprocess
# Basic: libreoffice --headless --convert-to pdf
# Advanced: Use python-uno to open calc, set page setup, export
```

Or use a **pre-conversion macro** that:
1. Opens the spreadsheet
2. Sets `FitToPagesWide = 1` (via UNO API)
3. Auto-selects paper size (replicate the paper catalog logic)
4. Exports to PDF

---

## Supported File Extensions

| Format | Extensions |
|--------|-----------|
| Word | `.doc`, `.docx`, `.docm` |
| Excel | `.xls`, `.xlsx`, `.xlsm` |
| PowerPoint | `.ppt`, `.pptx`, `.pptm` |

---

## Configuration Dataclasses

Key settings from [config.py](file:///d:/Project/RAG/ragflow-simple-ui%20-main/client/src/config.py):

- `PDFConversionSettings`: scope, layout, metadata, bookmarks, compliance, optimization
- `ExcelSettings`: sheet_name, orientation, row_dimensions, metadata_header, min_shrink_factor, ocr_sheet_name_label, oversized_action, page_shrink_threshold
- `PowerPointSettings`: color_mode, slide_from, slide_to
- `LayoutSettings`: orientation, pages_per_sheet, margins
