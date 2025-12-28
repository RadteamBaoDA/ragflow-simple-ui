
import { Router } from 'express';
import { PromptController } from '@/controllers/prompt.controller.js';
import { requireAuth } from '@/middleware/auth.middleware.js'; // Assuming this exists, will check

const router = Router();

// Public or Protected? detailed requirements implied user feedback, so likely protected.
// "Prompt will create default value for selected is All and get source name from chat"
// We'll apply auth middleware.

router.get('/', PromptController.getPrompts); // List prompts
router.post('/', requireAuth, PromptController.createPrompt); // Install/Create prompt
router.get('/tags', PromptController.getTags); // Get tags
router.get('/sources', PromptController.getSources); // Get sources
router.get('/chat-sources', PromptController.getChatSources); // Get chat source names for tags
router.put('/:id', requireAuth, PromptController.updatePrompt); // Update
router.delete('/:id', requireAuth, PromptController.deletePrompt); // Delete
router.post('/interactions', requireAuth, PromptController.addInteraction); // Like/Dislike/Comment
router.get('/:id/feedback-counts', PromptController.getFeedbackCounts); // Get like/dislike counts
router.get('/:id/interactions', PromptController.getInteractions); // Get all feedback for a prompt

export default router;
