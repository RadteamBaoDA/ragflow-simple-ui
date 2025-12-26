import { ModelFactory } from '@/models/factory.js';
import { db } from '@/db/knex.js';

export class ChatHistoryService {
    /**
     * Search chat sessions for a user with pagination and filtering.
     */
    async searchSessions(
        userId: string,
        limit: number,
        offset: number,
        search: string,
        startDate: string,
        endDate: string
    ) {
        let query = ModelFactory.chatSession.getKnex()
            .from('chat_sessions')
            .select(
                'chat_sessions.*',
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

        if (search) {
            query = query.where(builder => {
                builder.where('title', 'ilike', `%${search}%`)
                    .orWhereExists(function () {
                        this.select('*')
                            .from('chat_messages')
                            .whereRaw('chat_messages.session_id = chat_sessions.id')
                            .andWhere('content', 'ilike', `%${search}%`);
                    });
            });
        }

        if (startDate) {
            query = query.where('created_at', '>=', startDate);
        }

        if (endDate) {
            query = query.where('created_at', '<=', endDate);
        }

        // Get total count
        const countQuery = ModelFactory.chatSession.getKnex()
            .from('chat_sessions')
            .where('user_id', userId);

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

        if (startDate) {
            countQuery.where('created_at', '>=', startDate);
        }

        if (endDate) {
            countQuery.where('created_at', '<=', endDate);
        }

        const [sessions, totalResult] = await Promise.all([
            query,
            countQuery.count('id as total').first()
        ]);

        const total = totalResult ? parseInt(totalResult.total as string, 10) : 0;

        return { sessions, total };
    }

    /**
     * Delete a single chat session.
     */
    async deleteSession(userId: string, sessionId: string): Promise<boolean> {
        const deleted = await ModelFactory.chatSession.getKnex()
            .from('chat_sessions')
            .where({ id: sessionId, user_id: userId })
            .delete();

        return deleted > 0;
    }

    /**
     * Bulk delete chat sessions.
     */
    async deleteSessions(userId: string, sessionIds: string[], all: boolean): Promise<number> {
        let query = ModelFactory.chatSession.getKnex()
            .from('chat_sessions')
            .where('user_id', userId);

        if (all) {
            // Delete all sessions for user
        } else if (Array.isArray(sessionIds) && sessionIds.length > 0) {
            query = query.whereIn('id', sessionIds);
        } else {
            return 0;
        }

        return await query.delete();
    }
}

export const chatHistoryService = new ChatHistoryService();
