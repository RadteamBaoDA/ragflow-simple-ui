import { db } from '@/db/knex.js';
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';

export class AdminHistoryService {
    /**
     * Get chat history with pagination and search.
     */
    async getChatHistory(
        page: number,
        limit: number,
        search: string,
        email: string,
        startDate: string,
        endDate: string
    ) {
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

        return await query;
    }

    /**
     * Get details for a specific chat session.
     */
    async getChatSessionDetails(sessionId: string) {
        return await ModelFactory.externalChatHistory.getKnex()
            .from('external_chat_history')
            .select('*')
            .where('session_id', sessionId)
            .orderBy('created_at', 'asc');
    }

    /**
     * Get search history grouped by session.
     */
    async getSearchHistory(
        page: number,
        limit: number,
        search: string,
        email: string,
        startDate: string,
        endDate: string
    ) {
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

        return await query;
    }

    /**
     * Get details for a specific search session.
     */
    async getSearchSessionDetails(sessionId: string) {
        return await ModelFactory.externalSearchHistory.getKnex()
            .from('external_search_history')
            .select('*')
            .where('session_id', sessionId)
            .orderBy('created_at', 'asc');
    }

    /**
     * Get system chat history (internal).
     */
    async getSystemChatHistory(
        page: number,
        limit: number,
        search: string
    ) {
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

        return await query;
    }
}

export const adminHistoryService = new AdminHistoryService();
