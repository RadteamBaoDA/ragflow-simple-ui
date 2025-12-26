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

        // Base query to select chat sessions grouped by session_id
        let query = ModelFactory.externalChatHistory.getKnex()
            .select(
                'session_id',
                db.raw('MAX(created_at) as created_at'),
                db.raw('MAX(user_email) as user_email'),
                db.raw("(array_agg(user_prompt ORDER BY created_at ASC))[1] as user_prompt"),
                db.raw('COUNT(*) as message_count')
            )
            .from('external_chat_history')
            // Always filter by user email for data isolation
            .where('user_email', userEmail)
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
     * Verifies ownership by user email before returning data.
     * 
     * @param {string} sessionId - The session ID to retrieve.
     * @param {string} userEmail - The email of the requesting user.
     * @returns {Promise<any[]>} - Array of chat messages in the session.
     */
    async getChatSessionDetails(sessionId: string, userEmail: string) {
        // Query all messages for the session, filtered by user email
        return await ModelFactory.externalChatHistory.getKnex()
            .from('external_chat_history')
            .select('*')
            .where('session_id', sessionId)
            .andWhere('user_email', userEmail)
            .orderBy('created_at', 'asc');
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

        // Base query to select search sessions grouped by session_id
        let query = ModelFactory.externalSearchHistory.getKnex()
            .select(
                'session_id',
                db.raw('MAX(created_at) as created_at'),
                db.raw('MAX(user_email) as user_email'),
                db.raw("(array_agg(search_input ORDER BY created_at ASC))[1] as search_input"),
                db.raw('COUNT(*) as message_count')
            )
            .from('external_search_history')
            // Always filter by user email for data isolation
            .where('user_email', userEmail)
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
     * Verifies ownership by user email before returning data.
     * 
     * @param {string} sessionId - The session ID to retrieve.
     * @param {string} userEmail - The email of the requesting user.
     * @returns {Promise<any[]>} - Array of search records in the session.
     */
    async getSearchSessionDetails(sessionId: string, userEmail: string) {
        // Query all search entries for the session, filtered by user email
        return await ModelFactory.externalSearchHistory.getKnex()
            .from('external_search_history')
            .select('*')
            .where('session_id', sessionId)
            .andWhere('user_email', userEmail)
            .orderBy('created_at', 'asc');
    }
}

// Export singleton instance
export const userHistoryService = new UserHistoryService();
