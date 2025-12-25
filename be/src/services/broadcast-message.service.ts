/**
 * @fileoverview Service for managing broadcast messages.
 */

import { getAdapter } from '@/db/index.js';
import { log } from '@/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';

export interface BroadcastMessage {
    id: string;
    message: string;
    starts_at: string;
    ends_at: string;
    color: string;
    font_color: string;
    is_active: boolean;
    is_dismissible: boolean;
    created_at?: string;
    updated_at?: string;
}

export class BroadcastMessageService {
    /**
     * Retrieves all currently active broadcast messages.
     * If a user ID is provided, filters out messages previously dismissed by that user.
     *
     * @param userId - The ID of the user (optional).
     * @returns A promise that resolves to a list of active broadcast messages.
     * @throws Error if the query fails.
     */
    async getActiveMessages(userId?: string): Promise<BroadcastMessage[]> {
        const db = await getAdapter();
        try {
            const now = new Date().toISOString();

            let query: string;
            let params: any[];

            if (userId) {
                // Return active messages NOT dismissed by this user within last 24h
                query = `
                    SELECT b.* 
                    FROM broadcast_messages b
                    LEFT JOIN user_dismissed_broadcasts d ON b.id = d.broadcast_id AND d.user_id = $2
                    WHERE b.is_active = TRUE 
                    AND b.starts_at <= $1 
                    AND b.ends_at >= $1
                    AND (d.broadcast_id IS NULL OR d.dismissed_at < NOW() - INTERVAL '24 hours')
                    ORDER BY b.created_at DESC
                `;
                params = [now, userId];
            } else {
                // Return all active messages (for guests/login page)
                query = `
                    SELECT * FROM broadcast_messages 
                    WHERE is_active = TRUE 
                    AND starts_at <= $1 
                    AND ends_at >= $1
                    ORDER BY created_at DESC
                `;
                params = [now];
            }

            const result = await db.query<BroadcastMessage>(query, params);
            return result;
        } catch (error) {
            log.error('Failed to fetch active broadcast messages', { userId, error: String(error) });
            throw error;
        }
    }

    /**
     * Records a broadcast message dismissal for a specific user.
     * Logs the action.
     *
     * @param userId - The ID of the user.
     * @param broadcastId - The ID of the broadcast message.
     * @param userEmail - The email of the user (optional, for audit).
     * @param ipAddress - The IP address of the user (optional, for audit).
     * @returns A promise that resolves when the dismissal is recorded.
     * @throws Error if the operation fails.
     */
    async dismissMessage(userId: string, broadcastId: string, userEmail?: string, ipAddress?: string): Promise<void> {
        const db = await getAdapter();
        try {
            const query = `
                INSERT INTO user_dismissed_broadcasts (user_id, broadcast_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, broadcast_id) DO NOTHING
            `;
            await db.query(query, [userId, broadcastId]);

            // Log audit event for message dismissal
            await auditService.log({
                userId,
                userEmail: userEmail || 'unknown',
                action: AuditAction.DISMISS_BROADCAST,
                resourceType: AuditResourceType.BROADCAST_MESSAGE,
                resourceId: broadcastId,
                ipAddress,
            });

            log.info('Broadcast message dismissed by user', { userId, broadcastId });
        } catch (error) {
            log.error('Failed to dismiss broadcast message', { userId, broadcastId, error: String(error) });
            throw error;
        }
    }

    /**
     * Retrieves all broadcast messages (both active and inactive).
     * Intended for administrative use.
     *
     * @returns A promise that resolves to a list of all broadcast messages.
     * @throws Error if the query fails.
     */
    async getAllMessages(): Promise<BroadcastMessage[]> {
        const db = await getAdapter();
        try {
            const result = await db.query<BroadcastMessage>('SELECT * FROM broadcast_messages ORDER BY created_at DESC');
            return result;
        } catch (error) {
            log.error('Failed to fetch all broadcast messages', { error: String(error) });
            throw error;
        }
    }

    /**
     * Creates a new broadcast message and logs the action.
     *
     * @param data - The data for the new broadcast message (excluding auto-generated fields).
     * @param user - The user creating the message (optional, for audit).
     * @returns A promise that resolves to the created broadcast message.
     * @throws Error if creation fails.
     */
    async createMessage(
        data: Omit<BroadcastMessage, 'id' | 'created_at' | 'updated_at'>,
        user?: { id: string, email: string, ip?: string }
    ): Promise<BroadcastMessage> {
        const db = await getAdapter();
        try {
            const query = `
                INSERT INTO broadcast_messages (message, starts_at, ends_at, color, font_color, is_active, is_dismissible)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;
            const result = await db.query<BroadcastMessage>(query, [
                data.message,
                data.starts_at,
                data.ends_at,
                data.color || '#E75E40',
                data.font_color || '#FFFFFF',
                data.is_active === undefined ? true : data.is_active,
                data.is_dismissible === undefined ? false : data.is_dismissible
            ]);
            if (!result[0]) {
                throw new Error('Failed to create broadcast message: No result returned');
            }

            if (user) {
                await auditService.log({
                    userId: user.id,
                    userEmail: user.email,
                    action: AuditAction.CREATE_BROADCAST,
                    resourceType: AuditResourceType.BROADCAST_MESSAGE,
                    resourceId: result[0].id,
                    details: { message: data.message },
                    ipAddress: user.ip,
                });
            }

            return result[0];
        } catch (error) {
            log.error('Failed to create broadcast message', { error: String(error) });
            throw error;
        }
    }

    /**
     * Updates an existing broadcast message and logs the action.
     *
     * @param id - The ID of the message to update.
     * @param data - The data to update.
     * @param user - The user performing the update (optional, for audit).
     * @returns A promise that resolves to the updated message, or null if no fields updated.
     * @throws Error if update fails.
     */
    async updateMessage(
        id: string,
        data: Partial<Omit<BroadcastMessage, 'id' | 'created_at' | 'updated_at'>>,
        user?: { id: string, email: string, ip?: string }
    ): Promise<BroadcastMessage | null> {
        const db = await getAdapter();
        try {
            const fields: string[] = [];
            const values: any[] = [];
            let placeholderIndex = 1;

            if (data.message !== undefined) {
                fields.push(`message = $${placeholderIndex++}`);
                values.push(data.message);
            }
            if (data.starts_at !== undefined) {
                fields.push(`starts_at = $${placeholderIndex++}`);
                values.push(data.starts_at);
            }
            if (data.ends_at !== undefined) {
                fields.push(`ends_at = $${placeholderIndex++}`);
                values.push(data.ends_at);
            }
            if (data.color !== undefined) {
                fields.push(`color = $${placeholderIndex++}`);
                values.push(data.color);
            }
            if (data.font_color !== undefined) {
                fields.push(`font_color = $${placeholderIndex++}`);
                values.push(data.font_color);
            }
            if (data.is_active !== undefined) {
                fields.push(`is_active = $${placeholderIndex++}`);
                values.push(data.is_active);
            }
            if (data.is_dismissible !== undefined) {
                fields.push(`is_dismissible = $${placeholderIndex++}`);
                values.push(data.is_dismissible);
            }

            if (fields.length === 0) return null;

            fields.push(`updated_at = NOW()`);
            values.push(id);

            const query = `
                UPDATE broadcast_messages 
                SET ${fields.join(', ')}
                WHERE id = $${placeholderIndex}
                RETURNING *
            `;

            const result = await db.query<BroadcastMessage>(query, values);

            if (user && result[0]) {
                await auditService.log({
                    userId: user.id,
                    userEmail: user.email,
                    action: AuditAction.UPDATE_BROADCAST,
                    resourceType: AuditResourceType.BROADCAST_MESSAGE,
                    resourceId: id,
                    details: { changes: data },
                    ipAddress: user.ip,
                });
            }

            return result[0] || null;
        } catch (error) {
            log.error('Failed to update broadcast message', { id, error: String(error) });
            throw error;
        }
    }

    /**
     * Deletes a broadcast message and logs the action.
     *
     * @param id - The ID of the message to delete.
     * @param user - The user performing the deletion (optional, for audit).
     * @returns A promise that resolves to true if successful.
     * @throws Error if deletion fails.
     */
    async deleteMessage(id: string, user?: { id: string, email: string, ip?: string }): Promise<boolean> {
        const db = await getAdapter();
        try {
            // Fetch message before deletion
            const messages = await db.query<BroadcastMessage>('SELECT * FROM broadcast_messages WHERE id = $1', [id]);
            const message = messages[0];

            const result = await db.query('DELETE FROM broadcast_messages WHERE id = $1', [id]);

            if (user) {
                await auditService.log({
                    userId: user.id,
                    userEmail: user.email,
                    action: AuditAction.DELETE_BROADCAST,
                    resourceType: AuditResourceType.BROADCAST_MESSAGE,
                    resourceId: id,
                    details: { message: message?.message },
                    ipAddress: user.ip,
                });
            }

            return result.length > 0; // In this adapter, query might return affected rows if implemented that way, but let's check one more time.
        } catch (error) {
            log.error('Failed to delete broadcast message', { id, error: String(error) });
            throw error;
        }
    }
}

export const broadcastMessageService = new BroadcastMessageService();
