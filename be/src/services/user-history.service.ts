/**
 * @fileoverview User History Service.
 * Provides methods for retrieving a user's personal chat and search history.
 * Filters all queries by the authenticated user's email for data isolation.
 * 
 * @module services/user-history.service
 */

import { db } from '@/db/knex.js';
import { ModelFactory } from '@/models/factory.js';

/**
 * Service class for managing user-specific history data.
 * All methods filter by user email to ensure users only see their own data.
 */
export class UserHistoryService {
    /**
     * Get chat history for a specific user with pagination and search.
     * 
     * @param {string} userEmail - The email of the user.
     * @param {number} page - Page number (1-indexed).
     * @param {number} limit - Items per page.
     * @param {string} search - Search query string.
     * @param {string} startDate - Filter by start date (ISO format).
     * @param {string} endDate - Filter by end date (ISO format).
     * @returns {Promise<any[]>} - Paginated chat history sessions.
     */
    async getChatHistory(
        userEmail: string,
        page: number,
        limit: number,
        search: string,
        startDate: string,
        endDate: string
    ) {
        // Calculate offset for pagination
        const offset = (page - 1) * limit;

        // Base query to select chat sessions
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
            .where('external_chat_sessions.user_email', userEmail)
            .orderBy('external_chat_sessions.updated_at', 'desc')
            .limit(limit)
            .offset(offset);

        // Apply search filter if provided
        if (search) {
            const cleanSearch = search.replace(/[^\w\s]/g, '').trim();
            const terms = cleanSearch.split(/\s+/).filter(t => t.length > 0);

            query = query.where(builder => {
                builder.whereExists(function () {
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

        if (startDate) {
            query = query.where('external_chat_sessions.updated_at', '>=', startDate);
        }

        if (endDate) {
            query = query.where('external_chat_sessions.updated_at', '<=', `${endDate} 23:59:59`);
        }

        return await query;
    }

    /**
     * Get details for a specific chat session.
     * Verifies ownership by user email before returning data.
     * 
     * @param {string} sessionId - The session ID to retrieve.
     * @param {string} userEmail - The email of the requesting user.
     * @returns {Promise<any[]>} - Array of chat messages in the session.
     */
    async getChatSessionDetails(sessionId: string, userEmail: string) {
        // Check session ownership first (optional but good for security, though subquery logic below implicitly handles it if we joined)
        // But simply querying messages and joining session or checking session first.

        // Simpler: Query messages where session_id matches AND session belongs to user.
        // But messages don't have user_email column anymore (it's in session).

        return await ModelFactory.externalChatMessage.getKnex()
            .select('external_chat_messages.*')
            .from('external_chat_messages')
            .join('external_chat_sessions', 'external_chat_messages.session_id', 'external_chat_sessions.session_id')
            .where('external_chat_messages.session_id', sessionId)
            .andWhere('external_chat_sessions.user_email', userEmail)
            .orderBy('external_chat_messages.created_at', 'asc');
    }

    /**
     * Get search history for a specific user with pagination and search.
     * 
     * @param {string} userEmail - The email of the user.
     * @param {number} page - Page number (1-indexed).
     * @param {number} limit - Items per page.
     * @param {string} search - Search query string.
     * @param {string} startDate - Filter by start date (ISO format).
     * @param {string} endDate - Filter by end date (ISO format).
     * @returns {Promise<any[]>} - Paginated search history sessions.
     */
    async getSearchHistory(
        userEmail: string,
        page: number,
        limit: number,
        search: string,
        startDate: string,
        endDate: string
    ) {
        // Calculate pagination offset
        const offset = (page - 1) * limit;

        // Base query to select search sessions
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
            .where('external_search_sessions.user_email', userEmail)
            .orderBy('external_search_sessions.updated_at', 'desc')
            .limit(limit)
            .offset(offset);

        // Apply search filter if provided
        if (search) {
            const cleanSearch = search.replace(/[^\w\s]/g, '').trim();
            const terms = cleanSearch.split(/\s+/).filter(t => t.length > 0);

            query = query.where(builder => {
                builder.whereExists(function () {
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

        if (startDate) {
            query = query.where('external_search_sessions.updated_at', '>=', startDate);
        }

        if (endDate) {
            query = query.where('external_search_sessions.updated_at', '<=', `${endDate} 23:59:59`);
        }

        return await query;
    }

    /**
     * Get details for a specific search session.
     * Verifies ownership by user email before returning data.
     * 
     * @param {string} sessionId - The session ID to retrieve.
     * @param {string} userEmail - The email of the requesting user.
     * @returns {Promise<any[]>} - Array of search records in the session.
     */
    async getSearchSessionDetails(sessionId: string, userEmail: string) {
        return await ModelFactory.externalSearchRecord.getKnex()
            .select('external_search_records.*')
            .from('external_search_records')
            .join('external_search_sessions', 'external_search_records.session_id', 'external_search_sessions.session_id')
            .where('external_search_records.session_id', sessionId)
            .andWhere('external_search_sessions.user_email', userEmail)
            .orderBy('external_search_records.created_at', 'asc');
    }
}

// Export singleton instance
export const userHistoryService = new UserHistoryService();
