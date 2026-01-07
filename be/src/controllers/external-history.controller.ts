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
     * @param req - Express request object containing chat history details in body.
     * @param res - Express response object.
     * @returns Promise<void> - Sends a JSON response with status.
     * @throws Error if service execution fails (caught and returned as 500).
     * @description Validates and persists external chat interactions including prompts, responses, and citations.
     */
    async collectChatHistory(req: Request, res: Response): Promise<void> {
        try {
            // Debug log incoming request to trace payload issues
            log.debug('External Chat History Request', { body: req.body });
            const { session_id, share_id, user_email, user_prompt, llm_response, citations } = req.body;

            // Validate required fields to ensure data integrity
            if (!session_id || !user_prompt || !llm_response) {
                log.warn('External Chat History Missing Fields', { body: req.body });
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }

            // Save chat history via service, normalizing citations to an array if missing
            await externalHistoryService.saveChatHistory({
                session_id,
                share_id,
                user_email,
                user_prompt,
                llm_response,
                citations: citations || [],
            });

            log.debug('External Chat History Success', { session_id });
            res.status(201).json({ message: 'Chat history saved successfully' });
        } catch (error) {
            // Log full error details for debugging and return generic 500 status to client
            log.error('Error collecting chat history', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Collects search history from external clients.
     * @param req - Express request object containing search history details in body.
     * @param res - Express response object.
     * @returns Promise<void> - Sends a JSON response with status.
     * @throws Error if service execution fails (caught and returned as 500).
     * @description Validates and persists external search interactions including queries, summaries, and results.
     */
    async collectSearchHistory(req: Request, res: Response): Promise<void> {
        try {
            // Debug log incoming request to trace payload issues
            log.debug('External Search History Request', { body: req.body });
            const { session_id, share_id, search_input, user_email, ai_summary, file_results } = req.body;

            // Validate required fields (search_input is the minimum requirement)
            if (!search_input) {
                log.warn('External Search History Missing Fields', { body: req.body });
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }

            // Save search history via service, providing defaults for optional fields
            await externalHistoryService.saveSearchHistory({
                session_id,
                share_id,
                search_input,
                user_email,
                ai_summary: ai_summary || '',
                file_results: file_results || [],
            });

            log.debug('External Search History Success', { search_input });
            res.status(201).json({ message: 'Search history saved successfully' });
        } catch (error) {
            // Log full error details for debugging and return generic 500 status to client
            log.error('Error collecting search history', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
