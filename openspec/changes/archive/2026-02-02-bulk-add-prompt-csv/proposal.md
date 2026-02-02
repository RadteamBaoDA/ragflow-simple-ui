# Proposal: Bulk Add Prompts via CSV

## Problem
Currently, users can only add prompts one by one through the UI. This is inefficient for teams or administrators who want to migrate existing prompt libraries or onboard a large number of prompts at once. There is no supported way to batch import data.

## Requirements
1. **CSV Import**: Allow users to upload a `.csv` file containing prompts.
2. **Column Support**:
   - `prompt` (Required): Supports multi-line text (standard CSV quoting).
   - `description` (Optional): Text description.
   - `tags` (Optional): Comma-separated list of tags (e.g., "coding, writing").
   - `source` (Optional): Source identifier (defaults to "import" or similar if empty).
3. **Validation & Preview**:
   - Parse CSV on the client-side.
   - Display a preview of parsed data before submission.
   - Validate required fields.
4. **Duplicate Handling**: Skip prompts that already exist in the database (based on exact prompt text match).
5. **Permissions**: Restrict this feature to users with `UPLOAD` or `FULL` permissions (Admins/Leaders).
6. **Guideline Update**: Update the in-app help/guideline system to explain how to use the bulk import feature and format the CSV.

## Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing -->
- `prompt-management`: Adding a new bulk insertion mechanism and UI entry point.
- `guideline-system`: Updating the `kb-prompts` guideline to cover the new feature.

## Impact
- **Frontend**:
  - New `BulkImportModal` component in `features/prompts`.
  - Update `PromptsPage` to add the "Import" button.
  - Dependencies: Add `papaparse` for robust CSV handling.
  - Update `guideline` data content.
- **Backend**:
  - New API endpoint `POST /prompts/bulk` in `PromptController`.
  - Transactional insert logic with "skip duplicate" check in `PromptService`.
