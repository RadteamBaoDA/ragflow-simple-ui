/**
 * Admin History Controller
 * Handles internal requests for viewing chat and search history.
 */
import { Request, Response } from 'express';
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { db } from '@/db/knex.js';

export class AdminHistoryController {
    /**
     * Get chat history with pagination and search.
     */
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

            // Subquery to find latest message per session matching filters
            // Actually, for simple filtering on fields that might be constant per session (like email), 
            // we can filter in the main query's WHERE or HAVING. 
            // But prompt/response search needs to check if ANY message in session matches.

            const offset = (page - 1) * limit;

            let query = ModelFactory.externalChatHistory.getKnex()
                .select(
                    'session_id',
                    db.raw('MAX(created_at) as created_at'),
                    db.raw('MAX(user_email) as user_email'),
                    db.raw("(array_agg(user_prompt ORDER BY created_at ASC))[1] as user_prompt"),
                    db.raw('COUNT(*) as message_count')
                )
                .from('external_chat_history')
                .groupBy('session_id')
                .orderByRaw('MAX(created_at) DESC')
                .limit(limit)
                .offset(offset);

            if (search) {
                // Hybrid Search Strategy:
                // 1. Websearch (Google-like): Handles quotes, minus, AND logic.
                // 2. Simple Prefix: Handles partial words (e.g. "reran" -> "reranker").
                // 3. Loose OR: Handles "bag of words" matching if strict AND fails (e.g. "key search reranker" -> finds "reranker").

                // Sanitize for raw to_tsquery
                const cleanSearch = search.replace(/[^\w\s]/g, '').trim();
                const terms = cleanSearch.split(/\s+/).filter(t => t.length > 0);

                if (terms.length > 0) {
                    const prefixQuery = terms.join(' & ') + ':*';
                    const orQuery = terms.join(' | ');

                    query = query.where(builder => {
                        builder.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search])
                            .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [prefixQuery])
                            .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [orQuery]);
                    });
                } else {
                    query = query.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search]);
                }
            }

            if (email) {
                query = query.where('user_email', 'ilike', `%${email}%`);
            }

            if (startDate) {
                query = query.where('created_at', '>=', startDate);
            }

            if (endDate) {
                query = query.where('created_at', '<=', `${endDate} 23:59:59`);
            }

            const sessions = await query;
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

            const messages = await ModelFactory.externalChatHistory.getKnex()
                .from('external_chat_history')
                .select('*')
                .where('session_id', sessionId)
                .orderBy('created_at', 'asc');

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

            const offset = (page - 1) * limit;

            let query = ModelFactory.externalSearchHistory.getKnex()
                .select(
                    'session_id',
                    db.raw('MAX(created_at) as created_at'),
                    db.raw('MAX(user_email) as user_email'),
                    db.raw("(array_agg(search_input ORDER BY created_at ASC))[1] as search_input"),
                    db.raw('COUNT(*) as message_count')
                )
                .from('external_search_history')
                .groupBy('session_id')
                .orderByRaw('MAX(created_at) DESC')
                .limit(limit)
                .offset(offset);

            if (search) {
                const cleanSearch = search.replace(/[^\w\s]/g, '').trim();
                const terms = cleanSearch.split(/\s+/).filter(t => t.length > 0);

                if (terms.length > 0) {
                    const prefixQuery = terms.join(' & ') + ':*';
                    const orQuery = terms.join(' | ');

                    query = query.where(builder => {
                        builder.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search])
                            .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [prefixQuery])
                            .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [orQuery]);
                    });
                } else {
                    query = query.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search]);
                }
            }

            if (email) {
                query = query.where('user_email', 'ilike', `%${email}%`);
            }

            if (startDate) {
                query = query.where('created_at', '>=', startDate);
            }

            if (endDate) {
                query = query.where('created_at', '<=', `${endDate} 23:59:59`);
            }

            const sessions = await query;
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

            const messages = await ModelFactory.externalSearchHistory.getKnex()
                .from('external_search_history')
                .select('*')
                .where('session_id', sessionId)
                .orderBy('created_at', 'asc');

            res.json(messages);
        } catch (error) {
            log.error('Error fetching search session details', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get system chat history... (unchanged)
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
                        .orWhereExists(function () {
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
