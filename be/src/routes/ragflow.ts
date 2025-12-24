/**
 * @fileoverview Routes for RAGFlow history collection.
 *
 * Provides endpoints to receive chat and search history from external clients
 * and queues them for background processing.
 *
 * @module routes/ragflow
 */

import { Router, Request, Response } from 'express';
import { addToHistoryQueue } from '../services/queue.service.js';
import { log } from '../services/logger.service.js';

const router = Router();

/**
 * POST /api/ragflow/chat-history
 * Collects chat history.
 */
router.post('/chat-history', async (req: Request, res: Response): Promise<void> => {
    try {
        const { session_id, user_prompt, llm_response, citation_info } = req.body;

        if (!session_id || !user_prompt || !llm_response) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        await addToHistoryQueue('chat', {
            session_id,
            user_prompt,
            llm_response,
            citation_info: citation_info || {}
        });

        res.status(202).json({ message: 'Chat history accepted' });
    } catch (error) {
        log.error('Error handling chat history', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/ragflow/search-history
 * Collects search history.
 */
router.post('/search-history', async (req: Request, res: Response): Promise<void> => {
    try {
        const { session_id, search_input, ai_summary, file_name_result } = req.body;

        if (!search_input) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        await addToHistoryQueue('search', {
            session_id,
            search_input,
            ai_summary,
            file_name_result: file_name_result || []
        });

        res.status(202).json({ message: 'Search history accepted' });
    } catch (error) {
        log.error('Error handling search history', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
