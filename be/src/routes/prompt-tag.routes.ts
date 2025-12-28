
/**
 * Routes for prompt tag API endpoints.
 */
import { Router } from 'express';
import { PromptTagController } from '@/controllers/prompt-tag.controller.js';
import { requireAuth } from '@/middleware/auth.middleware.js';

const router = Router();

// Public routes - read tags
router.get('/', PromptTagController.getTags);           // Get newest tags
router.get('/search', PromptTagController.searchTags);  // Search tags

// Protected routes - modify tags
router.post('/', requireAuth, PromptTagController.createTag);       // Create tag
router.post('/by-ids', PromptTagController.getTagsByIds);           // Get tags by IDs

export default router;
