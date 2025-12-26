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
     */
    async searchSessions(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const limit = parseInt(req.query.limit as string || '50', 10);
            const offset = parseInt(req.query.offset as string || '0', 10);
            const search = req.query.q as string || '';
            const startDate = req.query.startDate as string;
            const endDate = req.query.endDate as string;

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
            log.error('Error searching chat sessions', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Delete a chat session.
     */
    async deleteSession(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const sessionId = req.params.id;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const deleted = await chatHistoryService.deleteSession(userId, sessionId);

            if (deleted) {
                res.status(204).send();
            } else {
                res.status(404).json({ error: 'Session not found' });
            }
        } catch (error) {
            log.error('Error deleting chat session', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Bulk delete chat sessions.
     */
    async deleteSessions(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const { sessionIds, all } = req.body;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            if (!all && (!Array.isArray(sessionIds) || sessionIds.length === 0)) {
                res.status(400).json({ error: 'No sessions specified' });
                return;
            }

            const deletedCount = await chatHistoryService.deleteSessions(userId, sessionIds, all);
            res.json({ deleted: deletedCount });
        } catch (error) {
            log.error('Error deleting chat sessions', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
