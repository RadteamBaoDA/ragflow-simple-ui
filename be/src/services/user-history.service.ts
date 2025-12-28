/**
 * @fileoverview User History Service.
 * Provides methods for retrieving a user's personal chat and search history.
 * Filters all queries by the authenticated user's email for data isolation.
 * 
 * @module services/user-history.service
 */

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

        return await ModelFactory.externalChatSession.findHistoryByUser(
            userEmail,
            limit,
            offset,
            search,
            startDate,
            endDate
        );
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
        return await ModelFactory.externalChatMessage.findBySessionIdAndUserEmail(sessionId, userEmail);
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
        // Calculate offset for pagination
        const offset = (page - 1) * limit;

        return await ModelFactory.externalSearchSession.findHistoryByUser(
            userEmail,
            limit,
            offset,
            search,
            startDate,
            endDate
        );
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
        return await ModelFactory.externalSearchRecord.findBySessionIdAndUserEmail(sessionId, userEmail);
    }
}

// Export singleton instance
export const userHistoryService = new UserHistoryService();
