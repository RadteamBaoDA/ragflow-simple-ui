# Spec: Prompt Tag Management Dialog

## Behavior

### Scenario: Open Tag Management Dialog
GIVEN I am on the Prompt Library page
WHEN I click the "Manage Tags" button
THEN the "Manage Tags" dialog should open
AND I should see a list of existing tags
AND I should see a "Create Tag" button

### Scenario: Create New Tag
GIVEN I am on the "Manage Tags" dialog
WHEN I click "Create Tag"
AND I enter a unique tag name and select a color
AND I confirm the creation
THEN the new tag should appear in the list
AND the tag should be available for selection in the prompt form

### Scenario: Search Tags
GIVEN I am on the "Manage Tags" dialog
AND there are multiple tags (e.g., "AI", "Coding", "Writing")
WHEN I type "Cod" into the search bar
THEN only "Coding" tag should be displayed in the list

### Scenario: Update Tag
GIVEN I am on the "Manage Tags" dialog
WHEN I click the edit icon for a tag
AND I change the name or color
AND I save the changes
THEN the tag should be updated in the list
AND the tag should reflect the new properties in existing prompts

### Scenario: Delete Unused Tag
GIVEN I am on the "Manage Tags" dialog
AND a tag is NOT assigned to any prompt
WHEN I click the delete icon
AND I confirm the deletion
THEN the tag should be removed from the list

### Scenario: Unauthorized Access (Non-Admin)
GIVEN I am a non-admin user (e.g., role='user' or 'leader')
WHEN I view the Prompt Library
THEN I should NOT see the "Manage Tags" button
AND if I try to access the tag management API directly
THEN I should receive a 403 Forbidden error

## Requirements

### Data Model Changes
- **No schema changes required**: Existing `prompt_tags` table supports `id`, `name`, `color`.

### API Requirements
- `GET /api/prompt-tags`: Support pagination and search (Authenticated users).
- `POST /api/prompt-tags`: **Admin Only**. Create new tag.
- `PUT /api/prompt-tags/:id`: **Admin Only**. Update tag name and color.
- `DELETE /api/prompt-tags/:id`: **Admin Only**. Delete tag.
    - Must return 400 or 409 if tag is in use.

### UI Requirements
- **Authorization**: "Manage Tags" feature is visible/accessible only to users with `admin` role.
- **Entry Point**: Add "Manage Tags" button in `PromptLibraryModal` header (Hidden for non-admins).
- **Dialog Layout**:
    - Header: Title + "Create Tag" button.
    - Body: Search bar + Scrollable List of tags.
    - List Item: Color dot, Name, Edit Action, Delete Action.
- **Create/Edit Form**:
    - Name input (required, max length 50).
    - Color picker (preset palette + custom hex).
    - Validation: Name must be unique.
- **Theme Support**: Colors must work in both Light and Dark modes.
- **Localization**: All labels and messages must be in `en`, `vi`, `ja`.
