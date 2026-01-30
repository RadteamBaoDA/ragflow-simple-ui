# Tasks: Bulk Add Prompts via CSV

## 1. Backend Implementation

- [x] 1.1 Add `BulkCreatePromptDto` to `be/src/models/types.ts`
- [x] 1.2 Implement `findExistingPrompts` in `PromptModel` (accepts array of prompt strings)
- [x] 1.3 Add `bulkCreate` method to `PromptService` with transactional skip logic
- [x] 1.4 Add `POST /bulk` route to `PromptController` and register in `routes/prompts`

## 2. Frontend Implementation

- [x] 2.1 Install `papaparse` and `@types/papaparse`
- [x] 2.2 Create `BulkImportModal` component in `fe/src/features/prompts/components`
- [x] 2.3 Add CSV parsing logic with `papaparse` and Table Preview
- [x] 2.4 Integrate `BulkImportModal` into `PromptsPage` with permission check
- [x] 2.5 Connect to Backend API (`promptService.bulkCreate`)
- [x] 2.6 Implement 'Download Template' button with dynamic CSV generation
- [x] 2.7 Add i18n translations (EN, JA, VI)

## 3. Documentation & Polish

- [x] 3.1 Update `kb-prompts.guideline.ts` with CSV format instructions
- [x] 3.2 Verify permissions (only Admin/Leader can see Import button)
- [x] 3.3 Manual verification of multi-line import (see verification guide below)

---

## Manual Verification Guide

### Test 1: Import Button Visibility
1. Login as Admin/Leader -> Import CSV button should be visible
2. Login as regular User -> Import CSV button should be disabled/hidden

### Test 2: Download Template
1. Click "Import CSV" button
2. Click "Download Template" button
3. Verify CSV contains columns: prompt, description, tags, source

### Test 3: Multi-line Import
Create a test CSV file with this content:
```csv
prompt,description,tags,source
"This is a simple prompt",Test description,"tag1,tag2",manual
"This is a multi-line prompt.
It spans multiple lines.
Line 3 here.",Multi-line test,"multiline,test",manual
```

1. Upload the CSV file
2. Verify preview table shows both rows correctly
3. Click Import
4. Verify both prompts appear in the prompts list
5. Verify multi-line prompt preserves line breaks

### Test 4: Duplicate Handling
1. Import the same CSV again
2. Verify prompts are skipped (not duplicated)
3. Verify success message shows correct skipped count
