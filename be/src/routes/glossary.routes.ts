
/**
 * Routes for glossary management API endpoints.
 * Mounts task, keyword, and prompt builder routes with auth middleware.
 * @module routes/glossary.routes
 */
import { Router } from 'express';
import { GlossaryController } from '@/controllers/glossary.controller.js';
import { requireAuth, requireRole } from '@/middleware/auth.middleware.js';

const router = Router();

// ============================================================================
// Prompt Builder (read-only, all authenticated users)
// ============================================================================

// Get full glossary tree for Prompt Builder modal
router.get('/tree', requireAuth, GlossaryController.getTree);

// Search tasks and keywords
router.get('/search', requireAuth, GlossaryController.search);

// Generate prompt from task + keyword selections
router.post('/generate-prompt', requireAuth, GlossaryController.generatePrompt);

// ============================================================================
// Task Management (admin/leader only)
// ============================================================================

// List all tasks
router.get('/tasks', requireAuth, GlossaryController.listTasks);

// Get single task with keywords
router.get('/tasks/:id', requireAuth, GlossaryController.getTask);

// Create a new task
router.post('/tasks', requireRole('admin', 'leader'), GlossaryController.createTask);

// Update a task
router.put('/tasks/:id', requireRole('admin', 'leader'), GlossaryController.updateTask);

// Delete a task (cascades keywords)
router.delete('/tasks/:id', requireRole('admin', 'leader'), GlossaryController.deleteTask);

// ============================================================================
// Keyword Management (admin/leader only)
// ============================================================================

// List keywords for a task
router.get('/tasks/:taskId/keywords', requireAuth, GlossaryController.listKeywords);

// Create a keyword under a task
router.post('/tasks/:taskId/keywords', requireRole('admin', 'leader'), GlossaryController.createKeyword);

// Update a keyword
router.put('/keywords/:id', requireRole('admin', 'leader'), GlossaryController.updateKeyword);

// Delete a keyword
router.delete('/keywords/:id', requireRole('admin', 'leader'), GlossaryController.deleteKeyword);

// ============================================================================
// Bulk Import (admin/leader only)
// ============================================================================

// Bulk import tasks and keywords from Excel data
router.post('/bulk-import', requireRole('admin', 'leader'), GlossaryController.bulkImport);

export default router;
