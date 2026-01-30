# Design: Prompt Tag Management Dialog

## Architecture

The feature will be implemented using the existing backend-frontend architecture with Ant Design components.

### Frontend (`fe/`)
- **New Component**: `PromptTagManagementModal.tsx`
    - Manages the UI for listing, creating, editing, and deleting tags.
    - Uses `api/promptService.ts` for data interaction.
- **Integration**:
    - `PromptLibraryModal.tsx`: Add entry point (button) to open `PromptTagManagementModal`.
        - **Access Control**: Only render "Manage Tags" button if `user.role === 'admin'`.
    - `TagInput.tsx`: Refresh options when tags are modified externally (optional, or rely on next fetch).

### Backend (`be/`)
- **Controller**: `PromptTagController`
    - `updateTag` (PUT `/:id`)
    - `deleteTag` (DELETE `/:id`)
- **Service**: `PromptTagService`
    - `updateTag(id, name, color)`
    - `deleteTag(id)`
- **Data Access**: `PromptTagModel` (via `ModelFactory`)
    - Ensure atomic updates.
    - For deletion: Check constraint against `prompts` table.

## Data Flow

1. **View Tags**: Frontend calls `GET /api/prompt-tags` -> Controller -> Service -> DB -> Return JSON.
2. **Create Tag**: Frontend calls `POST /api/prompt-tags` -> Controller -> Service -> DB -> Return New Tag.
3. **Update Tag**:
    - Frontend calls `PUT /api/prompt-tags/:id` with new `{ name, color }`.
    - Backend updates `prompt_tags` table.
    - **Risk Validated**: Schema confirms `prompts.tags` is a JSONB array of strings.
        - *Strategy*:
            1. Update `name` and `color` in `prompt_tags` table.
            2. Perform a cascading update on `prompts` table:
               - Find all rows where `tags` JSONB array contains `old_name`.
               - Replace `old_name` with `new_name` in the array.
               - Depending on DB capabilities (Postgres), use `jsonb_set` or read-modify-write in transaction.
4. **Delete Tag**:
    - Frontend calls `DELETE /api/prompt-tags/:id`.
    - Backend checks if any prompt uses this tag name. -> If yes, Throw Error (Tag currently associated with X prompts).
    - If no usage, delete from `prompt_tags`.

## UI Design

### Components

**`PromptTagManagementModal`**
- **Props**: `open`, `onClose`
- **State**:
    - `tags`: List of tags
    - `editingTag`: Tag currently being edited (null if searching/viewing)
    - `searchQuery`: String
- **Layout**:
    - **Header**: "Manage Tags" title + "Create Tag" button.
    - **Search**: `Input.Search` at the top.
    - **List**: `List` component.
        - `List.Item`:
            - **Left**: Color badge (circle), Tag Name.
            - **Right**: Actions (Edit Icon, Delete Icon).
    - **Edit Mode (Inline or Sub-modal)**:
        - When "Create" or "Edit" is clicked, show a small form (Modal or inline).
        - Fields: Name (Input), Color (ColorPicker or Preset Grid).

## Error Handling

- **Validation Errors**: Duplicate name during create/update -> Show toast "Tag name already exists".
- **Deletion Errors**: Tag in use -> Show alert/toast "Cannot delete tag '{name}' because it is used in {count} prompts. Please remove it from prompts first."

## Security

- **Authorization**:
    - `GET` endpoints: Authenticated users (View/Search).
    - `POST/PUT/DELETE` endpoints: **Admin Only**.
        - Use `requireRole('admin')` middleware.
        - *Rationale*: Tag taxonomy should be controlled to prevent spam/duplication.

## Testing Strategy

- **Manual Verification**:
    1. Open dialog.
    2. Create tag "TestTag".
    3. Verify it appears in list.
    4. Edit "TestTag" to "UpdatedTag" + Change Color.
    5. Verify list updates.
    6. Verify `PromptLibraryModal` tag filter shows "UpdatedTag".
    7. Assign "UpdatedTag" to a prompt.
    8. Try to delete "UpdatedTag" -> Expect Error.
    9. Remove from prompt -> Delete "UpdatedTag" -> Expect Success.
