/**
 * @fileoverview Routes for collecting external chat and search history.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ExternalHistoryController } from '@/controllers/external-history.controller.js';
import { config } from '@/config/index.js';

const router = Router();
const controller = new ExternalHistoryController();

// Middleware to check API key if configured
const checkApiKey = (req: Request, res: Response, next: NextFunction) => {
    if (config.externalTrace.apiKey) {
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== config.externalTrace.apiKey) {
             res.status(401).json({ error: 'Unauthorized: Invalid API key' });
             return
        }
    }
    next();
};

/**
 * POST /api/external/history/chat
 * Collect chat history for a session.
 */
router.post('/chat', checkApiKey, controller.collectChatHistory.bind(controller));

/**
 * POST /api/external/history/search
 * Collect search history.
 */
router.post('/search', checkApiKey, controller.collectSearchHistory.bind(controller));

export default router;
