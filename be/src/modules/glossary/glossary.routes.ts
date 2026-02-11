
/**
 * Routes for glossary management API endpoints.
 * Mounts task, keyword, and prompt builder routes with auth middleware.
 * @module routes/glossary.routes
 */
import { Router } from 'express';
import { GlossaryController } from '@/modules/glossary/glossary.controller.js';
import { requireAuth, requireRole } from '@/shared/middleware/auth.middleware.js';

const router = Router();

// ============================================================================
// Prompt Builder (read-only, all authenticated users)
// ============================================================================

// Search tasks and keywords
router.get('/search', requireAuth, GlossaryController.search);

// Generate prompt from task + keyword selections
router.post('/generate-prompt', requireAuth, GlossaryController.generatePrompt);

// ============================================================================
// Task Management (admin/leader only)
// ============================================================================

// List all tasks
router.get('/tasks', requireAuth, GlossaryController.listTasks);

// Get single task
router.get('/tasks/:id', requireAuth, GlossaryController.getTask);

// Create a new task
router.post('/tasks', requireRole('admin', 'leader'), GlossaryController.createTask);

// Update a task
router.put('/tasks/:id', requireRole('admin', 'leader'), GlossaryController.updateTask);

// Delete a task
router.delete('/tasks/:id', requireRole('admin', 'leader'), GlossaryController.deleteTask);

// ============================================================================
// Keyword Management (admin/leader only)
// ============================================================================

// List all keywords
router.get('/keywords', requireAuth, GlossaryController.listKeywords);

// Create a keyword
router.post('/keywords', requireRole('admin', 'leader'), GlossaryController.createKeyword);

// Update a keyword
router.put('/keywords/:id', requireRole('admin', 'leader'), GlossaryController.updateKeyword);

// Delete a keyword
router.delete('/keywords/:id', requireRole('admin', 'leader'), GlossaryController.deleteKeyword);

// ============================================================================
// Bulk Import (admin/leader only)
// ============================================================================

// Bulk import tasks from Excel data
router.post('/bulk-import', requireRole('admin', 'leader'), GlossaryController.bulkImport);

// Bulk import keywords from Excel data
router.post('/keywords/bulk-import', requireRole('admin', 'leader'), GlossaryController.bulkImportKeywords);

export default router;
