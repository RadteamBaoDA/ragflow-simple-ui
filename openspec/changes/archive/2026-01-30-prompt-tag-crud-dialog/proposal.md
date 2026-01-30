# Prompt Tag CRUD Dialog

## Problem Statement

The current prompt management system allows users to create tags when adding prompts, but there is no dedicated UI to manage tags themselves. Users cannot:

- View all existing tags in a centralized list
- Edit tag names or colors after creation
- Delete unused or duplicate tags

This creates tag sprawl and makes it difficult to maintain a clean taxonomy.

## Proposed Solution

Create a new **Tag Management Dialog** accessible from the Prompts feature that provides full CRUD operations for prompt tags:

1. **Create** - Add new tags with custom names and colors
2. **Read** - View all tags in a searchable, paginated list
3. **Update** - Edit tag name and color
4. **Delete** - Remove unused tags (with usage validation)

## Capabilities

### New Capabilities

- `prompt-tag-management-dialog`: A modal dialog component for viewing, creating, editing, and deleting prompt tags

### Impacted Capabilities

- `fe/src/features/prompts`: Add entry point to open tag management dialog
- `be/src/routes/prompt-tag.routes.ts`: Add UPDATE and DELETE endpoints
- `be/src/controllers/prompt-tag.controller.ts`: Add update and delete handlers
- `be/src/services/prompt-tag.service.ts`: Add update, delete, and getAllTags methods
- `fe/src/features/prompts/api/promptService.ts`: Add update and delete API calls

## Scope

### In Scope

- Tag CRUD dialog UI with Ant Design components
- Backend API endpoints for update and delete operations
- Search/filter functionality for tags
- Color picker for tag customization
- Validation (prevent deleting tags in use)
- i18n support (en, vi, jp)
- Light/dark theme support

### Out of Scope

- Bulk tag operations
- Tag merging functionality
- Tag usage analytics
- Export/import tags
