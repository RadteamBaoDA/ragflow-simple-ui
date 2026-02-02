# Design: Bulk Add Prompts via CSV

## Context
The current prompt management system requires manual, one-by-one entry. This is a bottleneck for users migrating data or managing large libraries. We are adding a CSV import feature.

## Goals
**Goals:**
- Enable bulk import of prompts with tags and metadata.
- Ensure multi-line prompts are preserved correctly.
- Provide a safe "preview" step so users don't blindly import bad data.
- Prevent duplicate prompts from cluttering the database.

**Non-Goals:**
- Export functionality (future scope).
- updating existing prompts via CSV (only new inserts).
- Supporting massive datasets (>5MB/1000 rows) in one go (this is a UI feature, not a bulk data pipeline).

## Decisions

### 1. Client-Side Parsing (Papaparse)
We will parse the CSV on the client side using `papaparse`.
- **Rationale**: Immediate validation feedback. Reduces server load from malformed files. `papaparse` is the industry standard for robust CSV handling in JS, correctly handling quoted newlines (critical for prompts).
- **Alternative**: Server-side parsing. Rejected because it requires uploading the file first, then reporting errors asynchronously or in a second response. Client-side is snappier for this scale.

### 2. "Skip Duplicates" Strategy
The backend will check for existing prompts (by prompt text match) and skip them.
- **Rationale**: Safer than overwriting/updating. Preserves existing curated data.
- **Result**: The API will return a summary `{ imported: 10, skipped: 5 }`.

### 3. Transactional Insert
The backend will wrap the bulk insert operation in a database transaction.
- **Rationale**: Ensures data integrity. If the operation crashes halfway, we don't want a partial state. Note: "Skipped" duplicates do not count as failures/crashes, they are valid "no-op" outcomes within the transaction.

### 4. UI Workflow: Modal with Preview
1.  **Select**: User clicks "Import" -> Modal opens.
2.  **Upload**: User drops CSV.
3.  **Parse & Validate**: App parses CSV.
    *   If format is invalid (missing columns), show error.
    *   If valid, show a **Table Preview**.
4.  **Submit**: User confirms. App sends JSON payload to backend.
5.  **Result**: specific success/skip counts shown.

### 5. Dynamic Template Generation
We will generate the `template.csv` on the fly in the browser.
- **Rationale**: Ensures the template headers always match the current code constants and includes valid, multi-line examples without maintaining a separate static file.

## Risks / Trade-offs
- **Large Files**: Parsing large files (e.g., >10MB) on the main thread can freeze the UI.
    - **Mitigation**: We will enforce a hard limit of 1000 rows or 5MB, which is sufficient for "prompt management" use cases.
- **Encoding**: Users might upload Excel-encoded CSVs (not UTF-8) which can garble characters.
    - **Mitigation**: Papaparse tries to detect encoding, but we will explicitly recommend UTF-8 in the generic guidelines.

## API Design
**POST** `/api/prompts/bulk`
**Body**: `CreatePromptDto[]`
**Response**:
```json
{
  "success": true,
  "imported": 10,
  "skipped": 2,
  "errors": []
}
```
