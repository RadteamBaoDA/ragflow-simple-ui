
/**
 * External History Routes
 * Receives and logs chat/search history from external systems (e.g. extension, other apps).
 */
import { Router } from 'express';
import { ExternalHistoryController } from '@/modules/external/external-history.controller.js';
import { requireExternalApiKey } from '@/modules/external/middleware/auth-external.middleware.js';

const router = Router();
const controller = new ExternalHistoryController();

/**
 * @route POST /api/external/history/chat
 * @description Collect Chat History from external client.
 * @access Private (External API Key required)
 */
// Protected by API key check to ensure source validity
router.post('/chat', requireExternalApiKey, controller.collectChatHistory.bind(controller));

/**
 * @route POST /api/external/history/search
 * @description Collect Search History from external client.
 * @access Private (External API Key required)
 */
// Protected by API key check to ensure source validity
router.post('/search', requireExternalApiKey, controller.collectSearchHistory.bind(controller));

export default router;
