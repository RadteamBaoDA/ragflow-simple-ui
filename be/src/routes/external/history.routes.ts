/**
 * @fileoverview Routes for collecting external chat and search history.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { addChatHistoryJob, addSearchHistoryJob } from '@/services/queue.service.js';
import { log } from '@/services/logger.service.js';
import { config } from '@/config/index.js';

const router = Router();

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
router.post('/chat', checkApiKey, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { session_id, user_id, messages } = req.body;

        if (!session_id || !Array.isArray(messages)) {
             res.status(400).json({ error: 'Invalid request: session_id and messages array are required' });
             return
        }

        await addChatHistoryJob({
            sessionId: session_id,
            userId: user_id,
            messages: messages.map((msg: any) => ({
                prompt: msg.prompt,
                response: msg.response,
                citations: msg.citations
            }))
        });

        res.status(202).json({ message: 'Chat history queued for processing' });
    } catch (error) {
        log.error('Error queuing chat history', { error });
        next(error);
    }
});

/**
 * POST /api/external/history/search
 * Collect search history.
 */
router.post('/search', checkApiKey, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { session_id, user_id, query, summary, results } = req.body;

        if (!session_id || !query) {
             res.status(400).json({ error: 'Invalid request: session_id and query are required' });
             return
        }

        await addSearchHistoryJob({
            sessionId: session_id,
            userId: user_id,
            query,
            summary,
            results
        });

        res.status(202).json({ message: 'Search history queued for processing' });
    } catch (error) {
        log.error('Error queuing search history', { error });
        next(error);
    }
});

export default router;
