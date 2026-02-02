
import { Router } from 'express';
import { PromptController } from '@/controllers/prompt.controller.js';
import { requireAuth } from '@/middleware/auth.middleware.js'; // Assuming this exists, will check

const router = Router();

// Public or Protected? detailed requirements implied user feedback, so likely protected.
// "Prompt will create default value for selected is All and get source name from chat"
// We'll apply auth middleware.

router.get('/', requireAuth, PromptController.getPrompts); // List prompts
router.post('/', requireAuth, PromptController.createPrompt); // Install/Create prompt
router.post('/bulk', requireAuth, PromptController.bulkCreate); // Bulk import prompts
router.get('/tags', requireAuth, PromptController.getTags); // Get tags
router.get('/sources', requireAuth, PromptController.getSources); // Get sources
router.get('/chat-sources', requireAuth, PromptController.getChatSources); // Get chat source names for tags
router.put('/:id', requireAuth, PromptController.updatePrompt); // Update
router.delete('/:id', requireAuth, PromptController.deletePrompt); // Delete
router.post('/interactions', requireAuth, PromptController.addInteraction); // Like/Dislike/Comment
router.get('/:id/feedback-counts', requireAuth, PromptController.getFeedbackCounts); // Get like/dislike counts
router.get('/:id/interactions', requireAuth, PromptController.getInteractions); // Get all feedback for a prompt

export default router;
