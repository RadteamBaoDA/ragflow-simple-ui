/**
 * External History Routes
 */
import { Router } from 'express';
import { ExternalHistoryController } from '@/controllers/external-history.controller.js';
import { requireExternalApiKey } from '@/middleware/auth-external.middleware.js';

const router = Router();
const controller = new ExternalHistoryController();

// Collect Chat History
router.post('/chat', requireExternalApiKey, controller.collectChatHistory.bind(controller));

// Collect Search History
router.post('/search', requireExternalApiKey, controller.collectSearchHistory.bind(controller));

export default router;
