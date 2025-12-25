/**
 * Chat History Routes
 */
import { Router } from 'express';
import { ChatHistoryController } from '@/controllers/chat-history.controller.js';
import { requireAuth } from '@/middleware/auth.middleware.js';

const router = Router();
const controller = new ChatHistoryController();

router.get('/sessions/search', requireAuth, controller.searchSessions.bind(controller));
router.delete('/sessions/:id', requireAuth, controller.deleteSession.bind(controller));
router.delete('/sessions', requireAuth, controller.deleteSessions.bind(controller));

export default router;
