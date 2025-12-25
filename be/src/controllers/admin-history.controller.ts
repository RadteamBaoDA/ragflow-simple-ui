/**
 * Admin History Controller
 * Handles internal requests for viewing chat and search history.
 */
import { Request, Response } from 'express';
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';

export class AdminHistoryController {
    /**
     * Get chat history with pagination and search.
     */
    async getChatHistory(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string || '1', 10);
            const limit = parseInt(req.query.limit as string || '50', 10);
            const search = req.query.q as string || '';

            let query = ModelFactory.externalChatHistory.getKnex()
                .from('external_chat_history')
                .select('*')
                .orderBy('created_at', 'desc')
                .limit(limit)
                .offset((page - 1) * limit);

            if (search) {
                query = query.where('user_prompt', 'ilike', `%${search}%`)
                    .orWhere('llm_response', 'ilike', `%${search}%`);
            }

            const history = await query;
            res.json(history);
        } catch (error) {
            log.error('Error fetching chat history', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get search history with pagination and search.
     */
    async getSearchHistory(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string || '1', 10);
            const limit = parseInt(req.query.limit as string || '50', 10);
            const search = req.query.q as string || '';

            let query = ModelFactory.externalSearchHistory.getKnex()
                .from('external_search_history')
                .select('*')
                .orderBy('created_at', 'desc')
                .limit(limit)
                .offset((page - 1) * limit);

            if (search) {
                query = query.where('search_input', 'ilike', `%${search}%`)
                    .orWhere('ai_summary', 'ilike', `%${search}%`);
            }

            const history = await query;
            res.json(history);
        } catch (error) {
            log.error('Error fetching search history', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get system chat history with pagination and search.
     * Joins chat_sessions with users to provide user context.
     */
    async getSystemChatHistory(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string || '1', 10);
            const limit = parseInt(req.query.limit as string || '50', 10);
            const search = req.query.q as string || '';

            // Query chat_sessions joined with users
            let query = ModelFactory.chatSession.getKnex()
                .from('chat_sessions')
                .leftJoin('users', 'chat_sessions.user_id', 'users.id')
                .select(
                    'chat_sessions.*',
                    'users.email as user_email',
                    'users.display_name as user_name',
                    (ModelFactory.chatSession.getKnex().client as any).raw(`
                        COALESCE(
                            (
                                SELECT json_agg(json_build_object(
                                    'id', cm.id,
                                    'role', cm.role,
                                    'content', cm.content,
                                    'timestamp', cm.timestamp
                                ) ORDER BY cm.timestamp ASC)
                                FROM chat_messages cm
                                WHERE cm.session_id = chat_sessions.id
                            ),
                            '[]'
                        ) as messages
                    `)
                )
                .orderBy('chat_sessions.updated_at', 'desc')
                .limit(limit)
                .offset((page - 1) * limit);

            if (search) {
                query = query.where(builder => {
                    builder.where('chat_sessions.title', 'ilike', `%${search}%`)
                        .orWhere('users.email', 'ilike', `%${search}%`)
                        .orWhere('users.display_name', 'ilike', `%${search}%`)
                        .orWhereExists(function() {
                            this.select('*')
                                .from('chat_messages')
                                .whereRaw('chat_messages.session_id = chat_sessions.id')
                                .andWhere('content', 'ilike', `%${search}%`);
                        });
                });
            }

            const history = await query;
            res.json(history);
        } catch (error) {
            log.error('Error fetching system chat history', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
