# Tasks: Prompt Tag CRUD Dialog

## Backend Implementation

- [x] 1.1 Update `PromptTagService` to support tag updates
    - Method: `updateTag(id: string, name: string, color: string): Promise<PromptTag>`
    - Logic: Update `prompt_tags` table.
    - Logic: Implement cascading update for `prompts` table where `tags` array contains the old name (using JSONB query).
- [x] 1.2 Update `PromptTagService` to support tag deletion
    - Method: `deleteTag(id: string): Promise<void>`
    - Logic: Check if tag name exists in any `prompts` JSONB tags array.
    - Logic: Throw specific error if in use.
    - Logic: Delete from `prompt_tags` if unused.
- [x] 1.3 Add Update and Delete methods to `PromptTagController`
    - `updateTag`: Handle PUT request, validate input
    - `deleteTag`: Handle DELETE request, handle "in-use" error mapping to 409 Conflict
- [x] 1.4 Update `prompt-tag.routes.ts` with RBAC
    - Apply `requireRole('admin')` middleware to `POST`, `PUT`, `DELETE` routes
    - Ensure `GET` routes remain accessible to authenticated users

## Frontend Implementation

- [x] 2.1 Update `promptService.ts`
    - Add `updateTag(id, name, color)`
    - Add `deleteTag(id)`
- [x] 2.2 Create `PromptTagManagementModal` component
    - Setup Ant Design Modal state (open/close)
    - Implement List view with `PromptTag` data
    - Implement "Create/Edit" form (inline or sub-modal)
    - Implement Search/Filter logic for the list
    - Integrate with `promptService` hooks/calls
- [x] 2.3 Integrate into `PromptLibraryModal`
    - Add "Manage Tags" button to header
    - Condition: Only render if `user.role === 'admin'`
- [x] 2.4 Integrate into `PromptsPage` (Prompt Management Page)
    - Add "Manage Tags" button to header (next to Permissions)
    - Condition: Only render if `user.role === 'admin'`

## Verification

- [x] 3.1 Verify Backend Access Control
    - Test `POST/PUT/DELETE` as 'user' role -> Expect 403 Forbidden
    - Test `POST/PUT/DELETE` as 'admin' role -> Expect Success
- [x] 3.2 Verify Tag CRUD Operations
    - Create new tag -> Success
    - Edit tag name/color -> Success
    - Delete unused tag -> Success
- [x] 3.3 Verify Cascading Updates
    - Assign "Tag A" to a prompt
    - Rename "Tag A" to "Tag B"
    - Check Prompt -> Should now have "Tag B"
- [x] 3.4 Verify Delete Constraints
    - Assign "Tag B" to a prompt
    - Try to delete "Tag B" -> Expect Error Message
    - Remove "Tag B" from prompt
    - Delete "Tag B" -> Expect Success
