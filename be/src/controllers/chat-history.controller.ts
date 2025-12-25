/**
 * Chat History Controller
 * Handles internal user chat history retrieval and management.
 */
import { Request, Response } from 'express';
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';

export class ChatHistoryController {
    /**
     * Search chat sessions for the current user.
     */
    async searchSessions(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const limit = parseInt(req.query.limit as string || '50', 10);
            const offset = parseInt(req.query.offset as string || '0', 10);
            const search = req.query.q as string || '';
            const startDate = req.query.startDate as string;
            const endDate = req.query.endDate as string;

            // Access raw knex instance for raw queries (not the query builder from getKnex())
            // Since getKnex() returns a QueryBuilder, we need the client instance for .raw()
            // We can access it via .client or just use db directly if imported,
            // but to stick to the factory pattern, we can cast or assume getKnex() has context.
            // Actually, QueryBuilder doesn't have .raw(), but the Knex instance does.
            // Let's use the db instance from '@/db/knex.js' for raw expressions to be safe and clean.
            // Or better, since we are in the controller, we can import db.
            // But strict adherence to ModelFactory suggests we should add a helper there or use what's available.
            // BaseModel uses `protected knex = db`.
            // Let's fix this by importing db for raw expressions.

            const knex = ModelFactory.chatSession.getKnex();
            // Using `db.raw` is standard for Knex.

            // Re-import db at the top of file if needed, but let's try to access it via the model if possible.
            // ModelFactory.chatSession['knex'] is protected.
            // Let's just fix the import.

            let query = ModelFactory.chatSession.getKnex()
                .from('chat_sessions')
                .select(
                    'chat_sessions.*',
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
                .where('user_id', userId)
                .orderBy('updated_at', 'desc')
                .limit(limit)
                .offset(offset);

            if (search) {
                // Search in session title or message content
                query = query.where(builder => {
                    builder.where('title', 'ilike', `%${search}%`)
                        .orWhereExists(function() {
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

            // Get total count for pagination
            const countQuery = ModelFactory.chatSession.getKnex()
                .from('chat_sessions')
                .where('user_id', userId);

            if (search) {
                // Search in session title or message content
                countQuery.where(builder => {
                    builder.where('title', 'ilike', `%${search}%`)
                        .orWhereExists(function() {
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

            const totalResult = await countQuery.count('id as total').first();
            const total = totalResult ? parseInt(totalResult.total as string, 10) : 0;

            const sessions = await query;

            res.json({
                sessions,
                total
            });

        } catch (error) {
            log.error('Error searching chat sessions', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Delete a chat session.
     */
    async deleteSession(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const sessionId = req.params.id;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const deleted = await ModelFactory.chatSession.getKnex()
                .from('chat_sessions')
                .where({ id: sessionId, user_id: userId })
                .delete();

            if (deleted) {
                res.status(204).send();
            } else {
                res.status(404).json({ error: 'Session not found' });
            }
        } catch (error) {
            log.error('Error deleting chat session', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Bulk delete chat sessions.
     */
    async deleteSessions(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const { sessionIds, all } = req.body;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            let query = ModelFactory.chatSession.getKnex()
                .from('chat_sessions')
                .where('user_id', userId);

            if (all) {
                // Delete all sessions for user
            } else if (Array.isArray(sessionIds) && sessionIds.length > 0) {
                query = query.whereIn('id', sessionIds);
            } else {
                res.status(400).json({ error: 'No sessions specified' });
                return;
            }

            const deleted = await query.delete();
            res.json({ deleted });
        } catch (error) {
            log.error('Error deleting chat sessions', error as Record<string, unknown>);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
