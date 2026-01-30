
/**
 * Routes for prompt tag API endpoints.
 */
import { Router } from 'express';
import { PromptTagController } from '@/controllers/prompt-tag.controller.js';
import { requireAuth, requireRole } from '@/middleware/auth.middleware.js';

const router = Router();

// Public routes - read tags (require authentication)
router.get('/', requireAuth, PromptTagController.getTags);           // Get newest tags
router.get('/search', requireAuth, PromptTagController.searchTags);  // Search tags
router.post('/by-ids', requireAuth, PromptTagController.getTagsByIds); // Get tags by IDs

// Admin-only routes - create/modify/delete tags
router.post('/', requireRole('admin'), PromptTagController.createTag);     // Create tag
router.put('/:id', requireRole('admin'), PromptTagController.updateTag);   // Update tag
router.delete('/:id', requireRole('admin'), PromptTagController.deleteTag); // Delete tag

export default router;

