/**
 * External History Controller
 * Handles incoming requests for external chat and search history.
 */
import { Request, Response } from 'express';
import { queueService } from '@/services/queue.service.js';
import { log } from '@/services/logger.service.js';

export class ExternalHistoryController {
    /**
     * Collects chat history from external clients.
     */
    async collectChatHistory(req: Request, res: Response): Promise<void> {
        try {
            const { session_id, user_prompt, llm_response, citations } = req.body;

            if (!session_id || !user_prompt || !llm_response) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }

            await queueService.addChatHistoryJob({
                session_id,
                user_prompt,
                llm_response,
                citations: citations || [],
            });

            res.status(202).json({ message: 'Chat history collection started' });
        } catch (error) {
            log.error('Error collecting chat history', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Collects search history from external clients.
     */
    async collectSearchHistory(req: Request, res: Response): Promise<void> {
        try {
            const { search_input, ai_summary, file_results } = req.body;

            if (!search_input) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }

            await queueService.addSearchHistoryJob({
                search_input,
                ai_summary: ai_summary || '',
                file_results: file_results || [],
            });

            res.status(202).json({ message: 'Search history collection started' });
        } catch (error) {
            log.error('Error collecting search history', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
