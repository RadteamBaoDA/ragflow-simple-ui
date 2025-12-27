import { db } from '@/db/knex.js';
import { ModelFactory } from '@/models/factory.js';

export class AdminHistoryService {
    /**
     * Get chat history with pagination and search.
     * @param page - Page number.
     * @param limit - Items per page.
     * @param search - Search query string.
     * @param email - Filter by user email.
     * @param startDate - Filter by start date.
     * @param endDate - Filter by end date.
     * @returns Promise<any> - Paginated chat history.
     * @description Retrieving chat history with optional search and filtering.
     */
    async getChatHistory(
        page: number,
        limit: number,
        search: string,
        email: string,
        startDate: string,
        endDate: string,
        sourceName?: string
    ) {
        // Calculate offset for pagination
        const offset = (page - 1) * limit;

        // Base query on sessions
        let query = ModelFactory.externalChatSession.getKnex()
            .select(
                'external_chat_sessions.session_id',
                'external_chat_sessions.updated_at as created_at',
                'external_chat_sessions.user_email',
                'knowledge_base_sources.name as source_name',
                // Subquery for first prompt
                db.raw(`(
                    SELECT user_prompt FROM external_chat_messages 
                    WHERE session_id = external_chat_sessions.session_id 
                    ORDER BY created_at ASC LIMIT 1
                ) as user_prompt`),
                // Subquery for message count
                db.raw(`(
                    SELECT COUNT(*) FROM external_chat_messages 
                    WHERE session_id = external_chat_sessions.session_id
                ) as message_count`)
            )
            .from('external_chat_sessions')
            .leftJoin('knowledge_base_sources', 'external_chat_sessions.share_id', 'knowledge_base_sources.share_id')
            .orderBy('external_chat_sessions.updated_at', 'desc')
            .limit(limit)
            .offset(offset);

        // Apply filters
        if (search) {
            const cleanSearch = search.replace(/[^\w\s]/g, '').trim();
            const terms = cleanSearch.split(/\s+/).filter(t => t.length > 0);

            query = query.where(builder => {
                // Search in session email
                builder.where('external_chat_sessions.user_email', 'ilike', `%${search}%`)
                    // Or search in messages
                    .orWhereExists(function () {
                        const sub = this.select('id').from('external_chat_messages')
                            .whereRaw('external_chat_messages.session_id = external_chat_sessions.session_id');

                        if (terms.length > 0) {
                            const prefixQuery = terms.join(' & ') + ':*';
                            const orQuery = terms.join(' | ');
                            sub.where(b => {
                                b.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search])
                                    .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [prefixQuery])
                                    .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [orQuery]);
                            });
                        } else {
                            sub.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search]);
                        }
                    });
            });
        }

        if (email) {
            query = query.where('external_chat_sessions.user_email', 'ilike', `%${email}%`);
        }

        if (startDate) {
            query = query.where('external_chat_sessions.updated_at', '>=', startDate);
        }

        if (endDate) {
            query = query.where('external_chat_sessions.updated_at', '<=', `${endDate} 23:59:59`);
        }

        if (sourceName) {
            query = query.where('knowledge_base_sources.name', 'ilike', `%${sourceName}%`);
        }

        return await query;
    }

    /**
     * Get details for a specific chat session.
     * @param sessionId - The ID of the session.
     * @returns Promise<any> - Session details.
     * @description Retrieving all messages for a specific session ID.
     */
    async getChatSessionDetails(sessionId: string) {
        // Query to get all history entries for the session
        return await ModelFactory.externalChatMessage.getKnex()
            .from('external_chat_messages')
            .select('*')
            .where('session_id', sessionId)
            .orderBy('created_at', 'asc');
    }

    /**
     * Get search history grouped by session.
     * @param page - Page number.
     * @param limit - Items per page.
     * @param search - Search query string.
     * @param email - Filter by user email.
     * @param startDate - Filter by start date.
     * @param endDate - Filter by end date.
     * @returns Promise<any> - Paginated search history.
     * @description Retrieving search history with optional search and filtering.
     */
    async getSearchHistory(
        page: number,
        limit: number,
        search: string,
        email: string,
        startDate: string,
        endDate: string,
        sourceName?: string
    ) {
        // Calculate pagination offset
        const offset = (page - 1) * limit;

        // Base query on sessions
        let query = ModelFactory.externalSearchSession.getKnex()
            .select(
                'external_search_sessions.session_id',
                'external_search_sessions.updated_at as created_at',
                'external_search_sessions.user_email',
                'knowledge_base_sources.name as source_name',
                // Subquery for first search input
                db.raw(`(
                    SELECT search_input FROM external_search_records 
                    WHERE session_id = external_search_sessions.session_id 
                    ORDER BY created_at ASC LIMIT 1
                ) as search_input`),
                // Subquery for count
                db.raw(`(
                    SELECT COUNT(*) FROM external_search_records 
                    WHERE session_id = external_search_sessions.session_id
                ) as message_count`)
            )
            .from('external_search_sessions')
            .leftJoin('knowledge_base_sources', 'external_search_sessions.share_id', 'knowledge_base_sources.share_id')
            .orderBy('external_search_sessions.updated_at', 'desc')
            .limit(limit)
            .offset(offset);

        // Apply filters
        if (search) {
            const cleanSearch = search.replace(/[^\w\s]/g, '').trim();
            const terms = cleanSearch.split(/\s+/).filter(t => t.length > 0);

            query = query.where(builder => {
                builder.where('external_search_sessions.user_email', 'ilike', `%${search}%`)
                    .orWhereExists(function () {
                        const sub = this.select('id').from('external_search_records')
                            .whereRaw('external_search_records.session_id = external_search_sessions.session_id');

                        if (terms.length > 0) {
                            const prefixQuery = terms.join(' & ') + ':*';
                            const orQuery = terms.join(' | ');
                            sub.where(b => {
                                b.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search])
                                    .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [prefixQuery])
                                    .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [orQuery]);
                            });
                        } else {
                            sub.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search]);
                        }
                    });
            });
        }

        if (email) {
            query = query.where('external_search_sessions.user_email', 'ilike', `%${email}%`);
        }

        if (startDate) {
            query = query.where('external_search_sessions.updated_at', '>=', startDate);
        }

        if (endDate) {
            query = query.where('external_search_sessions.updated_at', '<=', `${endDate} 23:59:59`);
        }

        if (sourceName) {
            query = query.where('knowledge_base_sources.name', 'ilike', `%${sourceName}%`);
        }

        return await query;
    }

    /**
     * Get details for a specific search session.
     * @param sessionId - The ID of the session.
     * @returns Promise<any> - Search session details.
     * @description Retrieving all search queries for a specific session ID.
     */
    async getSearchSessionDetails(sessionId: string) {
        // Query to get all search entries for the session
        return await ModelFactory.externalSearchRecord.getKnex()
            .from('external_search_records')
            .select('*')
            .where('session_id', sessionId)
            .orderBy('created_at', 'asc');
    }

    /**
     * Get system chat history (internal).
     * @param page - Page number.
     * @param limit - Items per page.
     * @param search - Search query string.
     * @returns Promise<any> - Paginated system chat history.
     * @description Retrieving internal system chat sessions joined with user details and aggregated messages.
     */
    async getSystemChatHistory(
        page: number,
        limit: number,
        search: string
    ) {
        // Build base query joining chat_sessions with users
        let query = ModelFactory.chatSession.getKnex()
            .from('chat_sessions')
            .leftJoin('users', 'chat_sessions.user_id', 'users.id')
            .select(
                'chat_sessions.*',
                'users.email as user_email',
                'users.display_name as user_name',
                // Subquery to aggregate chat messages as JSON array
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

        // Apply search filter if provided
        if (search) {
            // Filter by session title, user email, display name, or message content
            query = query.where(builder => {
                builder.where('chat_sessions.title', 'ilike', `%${search}%`)
                    .orWhere('users.email', 'ilike', `%${search}%`)
                    .orWhere('users.display_name', 'ilike', `%${search}%`)
                    // Exists subquery for message content search
                    .orWhereExists(function () {
                        this.select('*')
                            .from('chat_messages')
                            .whereRaw('chat_messages.session_id = chat_sessions.id')
                            .andWhere('content', 'ilike', `%${search}%`);
                    });
            });
        }

        // Execute query and return results
        return await query;
    }
}

export const adminHistoryService = new AdminHistoryService();
