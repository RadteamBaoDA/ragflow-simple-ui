/**
 * Chat History Controller
 * Handles internal user chat history retrieval and management.
 */
import { Request, Response } from 'express';
import { log } from '@/services/logger.service.js';
import { chatHistoryService } from '@/services/chat-history.service.js';

export class ChatHistoryController {
    /**
     * Search chat sessions for the current user.
     * @param req - Express request object containing search filters.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async searchSessions(req: Request, res: Response): Promise<void> {
        try {
            // Validate user authentication
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // Parse pagination and filter parameters
            const limit = parseInt(req.query.limit as string || '50', 10);
            const offset = parseInt(req.query.offset as string || '0', 10);
            const search = req.query.q as string || '';
            const startDate = req.query.startDate as string;
            const endDate = req.query.endDate as string;

            // Call service to search sessions
            const result = await chatHistoryService.searchSessions(
                userId,
                limit,
                offset,
                search,
                startDate,
                endDate
            );

            res.json(result);

        } catch (error) {
            // Log error and return 500 status
            log.error('Error searching chat sessions', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Delete a chat session.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async deleteSession(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const sessionId = req.params.id;

            // Validate user authentication
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // Attempt to delete session via service
            const deleted = await chatHistoryService.deleteSession(userId, sessionId || '');

            // Respond based on deletion result
            if (deleted) {
                res.status(204).send();
            } else {
                res.status(404).json({ error: 'Session not found' });
            }
        } catch (error) {
            // Log error and return 500 status
            log.error('Error deleting chat session', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Bulk delete chat sessions.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async deleteSessions(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const { sessionIds, all } = req.body;

            // Validate user authentication
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // Validate input parameters
            if (!all && (!Array.isArray(sessionIds) || sessionIds.length === 0)) {
                res.status(400).json({ error: 'No sessions specified' });
                return;
            }

            // Perform bulk deletion via service
            const deletedCount = await chatHistoryService.deleteSessions(userId, sessionIds, all);
            res.json({ deleted: deletedCount });
        } catch (error) {
            // Log error and return 500 status
            log.error('Error deleting chat sessions', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
