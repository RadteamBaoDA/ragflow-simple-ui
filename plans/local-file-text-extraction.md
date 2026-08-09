# Spec: Local File Text Extraction

## 1. Goal

The ReactJS and NodeJS application must extract searchable text from local files before downstream Markdown conversion, chunking, embedding, or AI context assembly.

Use a hybrid, browser-first flow: process supported files locally and send a file to NodeJS only when browser processing is unsupported or exceeds configured resource limits.

## 2. Supported Formats

| Input | Primary implementation | Runtime |
| --- | --- | --- |
| TXT, MD, CSV, JSON, source code | Native `File.text()` | Browser |
| HTML, XML | Native text decoding plus safe markup parsing | Browser |
| PDF with a text layer | `pdfjs-dist` | Browser worker |
| Scanned or image-only PDF | `pdfjs-dist` page rendering plus `tesseract.js` | Browser workers |
| DOCX | `mammoth` | Browser; NodeJS fallback |
| XLS, XLSX | SheetJS Community Edition | Browser; NodeJS fallback |
| PPTX, ODT, ODS, ODP, RTF | `officeparser` | Browser; NodeJS fallback |
| Legacy DOC, PPT, MSG | Apache Tika or LibreOffice headless | NodeJS only |

Use each parser only for its assigned formats. Do not add a second parser for the same format unless corpus tests prove a coverage or fidelity gap.

## 3. Processing Flow

1. Validate file name, detected type, size, and configured limits.
2. Select the parser from the format table.
3. Extract native text first.
4. For each PDF page, use OCR only when the extracted text is empty or below a configurable threshold.
5. Normalize line endings, remove control characters, and retain page, slide, or sheet boundaries.
6. Return the extraction contract below.
7. Perform Markdown conversion, chunking, embedding, and indexing downstream; they are not extraction requirements.

Do not OCR an entire PDF when usable text already exists. Reuse one Tesseract worker across pages and terminate it when processing finishes or is cancelled.

## 4. Result Contract

```ts
type ExtractedDocument = {
  file: {
    name: string;
    mimeType: string;
    size: number;
  };
  text: string;
  sections: Array<{
    index: number;
    kind: "page" | "slide" | "sheet" | "document";
    label?: string;
    text: string;
    method: "native" | "ocr";
  }>;
  warnings: Array<{
    code: string;
    message: string;
    sectionIndex?: number;
  }>;
};
```

An extraction may succeed with warnings. It must fail when the file is unsupported, encrypted, corrupt, over limit, cancelled, or timed out before any useful text is produced.

## 5. Browser and Offline Requirements

- Run PDF, OCR, and Office parsing outside the React UI thread.
- Support progress, cancellation through `AbortSignal`, timeout, and deterministic worker cleanup.
- Bundle and serve the PDF.js worker from the application origin.
- For offline OCR, self-host the Tesseract worker, all core variants required by the installed version, and `eng.traineddata.gz` plus `vie.traineddata.gz`.
- Configure `workerPath`, `corePath`, and `langPath`; runtime CDN access is forbidden.
- Limit concurrent OCR jobs. Start with one worker and increase only after measurement.
- Route large or unsupported files to NodeJS instead of risking browser memory exhaustion.

Size, page-count, cell-count, and timeout limits must be configuration values established from target-device benchmarks, not hard-coded assumptions in this spec.

## 6. NodeJS Fallback

- Execute CPU-heavy parsing in worker threads or a separate process, never on the HTTP event loop.
- Use Apache Tika for broad text extraction. Use LibreOffice headless only when conversion is required for a format Tika cannot extract reliably.
- Apply per-job timeouts, memory limits, temporary-directory isolation, and cleanup.
- Return the same `ExtractedDocument` contract as browser extraction.
- Do not retain uploaded files after the job unless separate storage requirements explicitly allow it.

## 7. Security

- Treat every file as untrusted, including ZIP-based Office formats.
- Verify content signatures where possible; do not trust extension or browser MIME alone.
- Reject encrypted, password-protected, executable, oversized, and unsupported inputs with stable error codes.
- Enforce decompression, entry-count, page-count, worksheet-cell, memory, and execution-time limits.
- Never execute macros, embedded scripts, external links, or active content.
- Sanitize generated HTML before rendering it. Prefer plain text for AI ingestion.
- Do not log file content, OCR text, or personal data.

## 8. Performance Expectations

- Native text: fast and low memory.
- DOCX/PPTX and ordinary spreadsheets: moderate; cost grows with archive content and cell count.
- Text PDFs: moderate and approximately page-linear.
- OCR: slow and CPU-heavy; page rendering and recognition dominate latency.
- Processing must remain asynchronous, cancellable, and observable through per-file and per-section progress.

No fixed latency target is valid without representative files and target hardware. The implementation plan must add a benchmark corpus covering small, large, malformed, multilingual, text-PDF, and scanned-PDF inputs.

## 9. Licenses

| Component | License |
| --- | --- |
| `officeparser` | MIT |
| `mammoth` | BSD-2-Clause |
| SheetJS Community Edition | Apache-2.0 |
| `pdfjs-dist` | Apache-2.0 |
| `tesseract.js` and `tesseract.js-core` | Apache-2.0 |
| Apache Tika | Apache-2.0, with bundled component notices |
| LibreOffice | MPL-2.0 / LGPL-3.0+ and bundled component licenses |

These licenses can generally be used in closed-source products, but they are not all MIT. Preserve required copyright, license, attribution, and third-party notices. Keep Tika and LibreOffice as separate executables or services and have legal counsel review redistribution obligations before release.

## 10. Acceptance Criteria

1. A user can select one or more supported local files and see extraction progress without UI blocking.
2. Text PDFs use their text layer; image-only pages use OCR without reprocessing text pages.
3. English and Vietnamese OCR work with the network disabled after application installation.
4. Modern Office files are processed in the browser within configured limits; legacy or oversized files use NodeJS fallback.
5. Page, slide, and sheet boundaries are preserved in a common result contract.
6. Cancellation, timeout, partial warnings, unsupported formats, and corrupt files produce stable outcomes and release all workers and temporary files.
7. Extracted text is ready for optional Markdown conversion and downstream indexing; extraction itself does not create embeddings or call an AI model.
