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
        endDate: string
    ) {
        // Calculate offset for pagination
        const offset = (page - 1) * limit;

        // Base query to select chat sessions and stats
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

        // Apply search filter if provided
        if (search) {
            // Sanitize search input to remove special characters
            const cleanSearch = search.replace(/[^\w\s]/g, '').trim();
            // Split search into terms
            const terms = cleanSearch.split(/\s+/).filter(t => t.length > 0);

            // Construct full-text search query
            if (terms.length > 0) {
                // Combine terms for prefix search
                const prefixQuery = terms.join(' & ') + ':*';
                // Combine terms for OR search
                const orQuery = terms.join(' | ');

                // Apply hybrid search logic
                query = query.where(builder => {
                    builder.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search])
                        .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [prefixQuery])
                        .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [orQuery]);
                });
            } else {
                // Fallback to simple websearch if no valid terms
                query = query.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search]);
            }
        }

        // Apply email filter if provided
        if (email) {
            query = query.where('user_email', 'ilike', `%${email}%`);
        }

        // Apply start date filter if provided
        if (startDate) {
            query = query.where('created_at', '>=', startDate);
        }

        // Apply end date filter if provided
        if (endDate) {
            query = query.where('created_at', '<=', `${endDate} 23:59:59`);
        }

        // Execute query and return results
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
        return await ModelFactory.externalChatHistory.getKnex()
            .from('external_chat_history')
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
        endDate: string
    ) {
        // Calculate pagination offset
        const offset = (page - 1) * limit;

        // Base query to select search sessions and stats
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

        // Apply search filter if provided
        if (search) {
            // Sanitize search string
            const cleanSearch = search.replace(/[^\w\s]/g, '').trim();
            // Split into unique terms
            const terms = cleanSearch.split(/\s+/).filter(t => t.length > 0);

            // Construct search conditions
            if (terms.length > 0) {
                const prefixQuery = terms.join(' & ') + ':*';
                const orQuery = terms.join(' | ');

                // Apply hybrid full-text search
                query = query.where(builder => {
                    builder.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search])
                        .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [prefixQuery])
                        .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [orQuery]);
                });
            } else {
                // Fallback search
                query = query.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search]);
            }
        }

        // Apply email filter
        if (email) {
            query = query.where('user_email', 'ilike', `%${email}%`);
        }

        // Apply start date filter
        if (startDate) {
            query = query.where('created_at', '>=', startDate);
        }

        // Apply end date filter
        if (endDate) {
            query = query.where('created_at', '<=', `${endDate} 23:59:59`);
        }

        // Execute query and return results
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
        return await ModelFactory.externalSearchHistory.getKnex()
            .from('external_search_history')
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
