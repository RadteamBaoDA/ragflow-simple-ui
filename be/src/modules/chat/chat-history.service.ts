import { ModelFactory } from '@/shared/models/factory.js';
import { db } from '@/shared/db/knex.js';

export class ChatHistoryService {
    /**
     * Search chat sessions for a user with pagination and filtering.
     * @param userId - The ID of the user.
     * @param limit - Pagination limit.
     * @param offset - Pagination offset.
     * @param search - Search query string.
     * @param startDate - Date range start.
     * @param endDate - Date range end.
     * @returns Promise<{sessions: any[], total: number}> - List of sessions and total count.
     * @description Retrieves chat sessions matching criteria, including aggregated messages.
     */
    async searchSessions(
        userId: string,
        limit: number,
        offset: number,
        search: string,
        startDate: string,
        endDate: string
    ) {
        // Build base query for sessions with aggregated messages
        let query = ModelFactory.chatSession.getKnex()
            .from('chat_sessions')
            .select(
                'chat_sessions.*',
                // Subquery to aggregate chat messages into a JSON array
                db.raw(`
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
            .where('user_id', userId)
            .orderBy('updated_at', 'desc')
            .limit(limit)
            .offset(offset);

        // Apply search filter if provided
        if (search) {
            query = query.where(builder => {
                builder.where('title', 'ilike', `%${search}%`)
                    // OR condition: Check if any message in the session matches the search
                    .orWhereExists(function () {
                        this.select('*')
                            .from('chat_messages')
                            .whereRaw('chat_messages.session_id = chat_sessions.id')
                            .andWhere('content', 'ilike', `%${search}%`);
                    });
            });
        }

        // Apply start date filter
        if (startDate) {
            query = query.where('created_at', '>=', startDate);
        }

        // Apply end date filter
        if (endDate) {
            query = query.where('created_at', '<=', endDate);
        }

        // Prepare count query for pagination metadata
        const countQuery = ModelFactory.chatSession.getKnex()
            .from('chat_sessions')
            .where('user_id', userId);

        // Re-apply search filters to count query to match data query
        if (search) {
            countQuery.where(builder => {
                builder.where('title', 'ilike', `%${search}%`)
                    .orWhereExists(function () {
                        this.select('*')
                            .from('chat_messages')
                            .whereRaw('chat_messages.session_id = chat_sessions.id')
                            .andWhere('content', 'ilike', `%${search}%`);
                    });
            });
        }

        // Re-apply date filters to count query
        if (startDate) {
            countQuery.where('created_at', '>=', startDate);
        }

        if (endDate) {
            countQuery.where('created_at', '<=', endDate);
        }

        // Execute both queries in parallel
        const [sessions, totalResult] = await Promise.all([
            query,
            countQuery.count('id as total').first()
        ]);

        // Parse total count
        const total = totalResult ? parseInt(totalResult.total as string, 10) : 0;

        return { sessions, total };
    }

    /**
     * Delete a single chat session.
     * @param userId - The ID of the user owning the session.
     * @param sessionId - The ID of the session to delete.
     * @returns Promise<boolean> - True if deleted, false otherwise.
     * @description Deletes a chat session if it belongs to the specified user.
     */
    async deleteSession(userId: string, sessionId: string): Promise<boolean> {
        // execute delete operation ensuring user ownership
        const deleted = await ModelFactory.chatSession.getKnex()
            .from('chat_sessions')
            .where({ id: sessionId, user_id: userId })
            .delete();

        // Return true if any row was affected
        return deleted > 0;
    }

    /**
     * Bulk delete chat sessions.
     * @param userId - The ID of the user.
     * @param sessionIds - Array of session IDs to delete.
     * @param all - If true, delete all sessions for the user.
     * @returns Promise<number> - The number of deleted sessions.
     * @description Deletes multiple sessions or all sessions for a user.
     */
    async deleteSessions(userId: string, sessionIds: string[], all: boolean): Promise<number> {
        // Start building delete query
        let query = ModelFactory.chatSession.getKnex()
            .from('chat_sessions')
            .where('user_id', userId);

        if (all) {
            // Delete all sessions for user (no extra filters needed)
        } else if (Array.isArray(sessionIds) && sessionIds.length > 0) {
            // Filter by specific session IDs
            query = query.whereIn('id', sessionIds);
        } else {
            // No action if not all and no IDs provided
            return 0;
        }

        // Execute delete query and return count
        return await query.delete();
    }
}

export const chatHistoryService = new ChatHistoryService();
