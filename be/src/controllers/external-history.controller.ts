/**
 * External History Controller
 * Handles incoming requests for external chat and search history.
 */
import { Request, Response } from 'express';
import { externalHistoryService } from '@/services/external-history.service.js';
import { log } from '@/services/logger.service.js';

export class ExternalHistoryController {
    /**
     * Collects chat history from external clients.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async collectChatHistory(req: Request, res: Response): Promise<void> {
        try {
            // Debug log incoming request
            log.debug('External Chat History Request', { body: req.body });
            const { session_id, user_email, user_prompt, llm_response, citations } = req.body;

            // Validate required fields
            if (!session_id || !user_prompt || !llm_response) {
                log.warn('External Chat History Missing Fields', { body: req.body });
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }

            // Save chat history via service
            await externalHistoryService.saveChatHistory({
                session_id,
                user_email,
                user_prompt,
                llm_response,
                citations: citations || [],
            });

            log.debug('External Chat History Success', { session_id });
            res.status(201).json({ message: 'Chat history saved successfully' });
        } catch (error) {
            // Log error and return 500 status
            log.error('Error collecting chat history', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Collects search history from external clients.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async collectSearchHistory(req: Request, res: Response): Promise<void> {
        try {
            // Debug log incoming request
            log.debug('External Search History Request', { body: req.body });
            const { session_id, search_input, user_email, ai_summary, file_results } = req.body;

            // Validate required fields
            if (!search_input) {
                log.warn('External Search History Missing Fields', { body: req.body });
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }

            // Save search history via service
            await externalHistoryService.saveSearchHistory({
                session_id,
                search_input,
                user_email,
                ai_summary: ai_summary || '',
                file_results: file_results || [],
            });

            log.debug('External Search History Success', { search_input });
            res.status(201).json({ message: 'Search history saved successfully' });
        } catch (error) {
            // Log error and return 500 status
            log.error('Error collecting search history', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
