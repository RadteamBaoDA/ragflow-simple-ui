
/**
 * Chat History Routes
 * Handles user-specific operations on chat sessions (searching, deleting).
 */
import { Router } from 'express';
import { ChatHistoryController } from '@/modules/chat/chat-history.controller.js';
import { requireAuth } from '@/shared/middleware/auth.middleware.js';

const router = Router();
const controller = new ChatHistoryController();

/**
 * @route GET /api/chat-history/sessions/search
 * @description Search across the current user's chat sessions.
 * @access Private
 */
// Authenticated route to search user's own history
router.get('/sessions/search', requireAuth, controller.searchSessions.bind(controller));

/**
 * @route DELETE /api/chat-history/sessions/:id
 * @description Delete a specific chat session by ID.
 * @access Private
 */
// Authenticated route to delete a single session
router.delete('/sessions/:id', requireAuth, controller.deleteSession.bind(controller));

/**
 * @route DELETE /api/chat-history/sessions
 * @description Bulk delete multiple chat sessions.
 * @access Private
 */
// Authenticated route to delete multiple sessions at once
router.delete('/sessions', requireAuth, controller.deleteSessions.bind(controller));

export default router;
