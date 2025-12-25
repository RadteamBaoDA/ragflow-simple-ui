/**
 * Admin History Routes
 */
import { Router } from 'express';
import { AdminHistoryController } from '@/controllers/admin-history.controller.js';
import { requireAuth, requireRole } from '@/middleware/auth.middleware.js';

const router = Router();
const controller = new AdminHistoryController();

// Only admin and leaders can view history
// Assuming 'leader' is a valid role or just use 'admin'
router.get('/chat', requireAuth, requireRole('admin', 'leader'), controller.getChatHistory.bind(controller));
router.get('/chat/:sessionId', requireAuth, requireRole('admin', 'leader'), controller.getChatSessionDetails.bind(controller));
router.get('/search', requireAuth, requireRole('admin', 'leader'), controller.getSearchHistory.bind(controller));
router.get('/search/:sessionId', requireAuth, requireRole('admin', 'leader'), controller.getSearchSessionDetails.bind(controller));
router.get('/system-chat', requireAuth, requireRole('admin', 'leader'), controller.getSystemChatHistory.bind(controller));

export default router;
