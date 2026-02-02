# prompt-management

## ADDED Requirements

### Requirement: Bulk Import Prompts via CSV
The system SHALL allow authorized users to import multiple prompts from a CSV file.

#### Scenario: Successful Import
- **GIVEN** a CSV file with valid headers (`prompt`, `description`, `tags`, `source`) and 5 new prompts
- **WHEN** the user Uploads the file and confirms the preview
- **THEN** the system creates 5 new prompt records
- **AND** displays "Imported 5 prompts"

#### Scenario: Import with Duplicates
- **GIVEN** a CSV file with 3 prompts, where 1 prompt text matches an existing active prompt
- **WHEN** the user Uploads and Confirms
- **THEN** the system creates the 2 new prompts
- **AND** skips the 1 duplicate prompt
- **AND** displays "Imported 2, Skipped 1"

#### Scenario: Invalid CSV Format
- **GIVEN** a CSV file missing the required `prompt` header
- **WHEN** the user Uploads the file
- **THEN** the system prevents submission
- **AND** displays an error message "Missing required column: prompt"

#### Scenario: Permission Control
- **GIVEN** a user with `VIEW` permission
- **WHEN** they access the Prompts page
- **THEN** the "Import" button is NOT visible

#### Scenario: Multi-line Prompt Support
- **GIVEN** a CSV row where the `prompt` column contains newline characters (quoted)
- **WHEN** the prompt is imported
- **THEN** the stored prompt text preserves the newlines exactly as in the CSV
