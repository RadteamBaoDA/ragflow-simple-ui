/**
 * Admin History Controller
 * Handles internal requests for viewing chat and search history.
 */
import { Request, Response } from 'express';
import { log } from '@/services/logger.service.js';
import { adminHistoryService } from '@/services/admin-history.service.js';

export class AdminHistoryController {
    /**
     * Get chat history grouped by session.
     */
    async getChatHistory(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string || '1', 10);
            const limit = parseInt(req.query.limit as string || '20', 10);
            const search = req.query.q as string || '';
            const email = req.query.email as string || '';
            const startDate = req.query.startDate as string || '';
            const endDate = req.query.endDate as string || '';

            const sessions = await adminHistoryService.getChatHistory(page, limit, search, email, startDate, endDate);
            res.json(sessions);
        } catch (error) {
            log.error('Error fetching chat history', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get details for a specific chat session.
     */
    async getChatSessionDetails(req: Request, res: Response): Promise<void> {
        try {
            const { sessionId } = req.params;
            if (!sessionId) {
                res.status(400).json({ error: 'Session ID is required' });
                return;
            }

            const messages = await adminHistoryService.getChatSessionDetails(sessionId);
            res.json(messages);
        } catch (error) {
            log.error('Error fetching chat session details', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get search history grouped by session.
     */
    async getSearchHistory(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string || '1', 10);
            const limit = parseInt(req.query.limit as string || '20', 10);
            const search = req.query.q as string || '';
            const email = req.query.email as string || '';
            const startDate = req.query.startDate as string || '';
            const endDate = req.query.endDate as string || '';

            const sessions = await adminHistoryService.getSearchHistory(page, limit, search, email, startDate, endDate);
            res.json(sessions);
        } catch (error) {
            log.error('Error fetching search history', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get details for a specific search session.
     */
    async getSearchSessionDetails(req: Request, res: Response): Promise<void> {
        try {
            const { sessionId } = req.params;
            if (!sessionId) {
                res.status(400).json({ error: 'Session ID is required' });
                return;
            }

            const messages = await adminHistoryService.getSearchSessionDetails(sessionId);
            res.json(messages);
        } catch (error) {
            log.error('Error fetching search session details', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get system chat history...
     */
    async getSystemChatHistory(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string || '1', 10);
            const limit = parseInt(req.query.limit as string || '50', 10);
            const search = req.query.q as string || '';

            const history = await adminHistoryService.getSystemChatHistory(page, limit, search);
            res.json(history);
        } catch (error) {
            log.error('Error fetching system chat history', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
