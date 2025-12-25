/**
 * @fileoverview Service for managing broadcast messages.
 * 
 * Uses ModelFactory for all database operations following the Factory Pattern.
 */

import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { BroadcastMessage } from '@/models/types.js';

export class BroadcastMessageService {
    /**
     * Get all currently active broadcast messages.
     * If userId is provided, filter out messages that the user has already dismissed.
     * 
     * Uses ModelFactory.broadcastMessage.findActive() or findActiveExcludingDismissed().
     */
    async getActiveMessages(userId?: string): Promise<BroadcastMessage[]> {
        try {
            const now = new Date().toISOString();

            if (userId) {
                // Return active messages NOT dismissed by this user within last 24h
                return ModelFactory.broadcastMessage.findActiveExcludingDismissed(userId, now);
            } else {
                // Return all active messages (for guests/login page)
                return ModelFactory.broadcastMessage.findActive(now);
            }
        } catch (error) {
            log.error('Failed to fetch active broadcast messages', { userId, error: String(error) });
            throw error;
        }
    }

    /**
     * Record a message dismissal for a user.
     * 
     * Uses ModelFactory.userDismissedBroadcast.upsertDismissal() for INSERT ON CONFLICT.
     */
    async dismissMessage(userId: string, broadcastId: string, userEmail?: string, ipAddress?: string): Promise<void> {
        try {
            // Upsert dismissal record using model factory
            await ModelFactory.userDismissedBroadcast.upsertDismissal(userId, broadcastId);

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
     * Get all broadcast messages (admin only).
     * 
     * Uses ModelFactory.broadcastMessage.findAll() with ordering.
     */
    async getAllMessages(): Promise<BroadcastMessage[]> {
        try {
            return ModelFactory.broadcastMessage.findAll({}, { orderBy: { created_at: 'desc' } });
        } catch (error) {
            log.error('Failed to fetch all broadcast messages', { error: String(error) });
            throw error;
        }
    }

    /**
     * Create a new broadcast message.
     * 
     * Uses ModelFactory.broadcastMessage.create() for database insertion.
     */
    async createMessage(
        data: Omit<BroadcastMessage, 'id' | 'created_at' | 'updated_at'>,
        user?: { id: string, email: string, ip?: string }
    ): Promise<BroadcastMessage> {
        try {
            // Create message using model factory
            const message = await ModelFactory.broadcastMessage.create({
                message: data.message,
                starts_at: data.starts_at,
                ends_at: data.ends_at,
                color: data.color || '#E75E40',
                font_color: data.font_color || '#FFFFFF',
                is_active: data.is_active === undefined ? true : data.is_active,
                is_dismissible: data.is_dismissible === undefined ? false : data.is_dismissible
            });

            if (!message) {
                throw new Error('Failed to create broadcast message: No result returned');
            }

            // Log audit event for message creation
            if (user) {
                await auditService.log({
                    userId: user.id,
                    userEmail: user.email,
                    action: AuditAction.CREATE_BROADCAST,
                    resourceType: AuditResourceType.BROADCAST_MESSAGE,
                    resourceId: message.id,
                    details: { message: data.message },
                    ipAddress: user.ip,
                });
            }

            return message;
        } catch (error) {
            log.error('Failed to create broadcast message', { error: String(error) });
            throw error;
        }
    }

    /**
     * Update an existing broadcast message.
     * 
     * Uses ModelFactory.broadcastMessage.update() for partial updates.
     */
    async updateMessage(
        id: string,
        data: Partial<Omit<BroadcastMessage, 'id' | 'created_at' | 'updated_at'>>,
        user?: { id: string, email: string, ip?: string }
    ): Promise<BroadcastMessage | null> {
        try {
            // Build update data object with only defined fields
            const updateData: Partial<BroadcastMessage> = {};
            if (data.message !== undefined) updateData.message = data.message;
            if (data.starts_at !== undefined) updateData.starts_at = data.starts_at;
            if (data.ends_at !== undefined) updateData.ends_at = data.ends_at;
            if (data.color !== undefined) updateData.color = data.color;
            if (data.font_color !== undefined) updateData.font_color = data.font_color;
            if (data.is_active !== undefined) updateData.is_active = data.is_active;
            if (data.is_dismissible !== undefined) updateData.is_dismissible = data.is_dismissible;

            // Return null if no fields to update
            if (Object.keys(updateData).length === 0) return null;

            // Update message using model factory
            const message = await ModelFactory.broadcastMessage.update(id, updateData);

            // Log audit event for message update
            if (user && message) {
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

            return message || null;
        } catch (error) {
            log.error('Failed to update broadcast message', { id, error: String(error) });
            throw error;
        }
    }

    /**
     * Delete a broadcast message.
     * 
     * Uses ModelFactory.broadcastMessage.findById() and delete().
     */
    async deleteMessage(id: string, user?: { id: string, email: string, ip?: string }): Promise<boolean> {
        try {
            // Fetch message before deletion for audit logging
            const message = await ModelFactory.broadcastMessage.findById(id);

            // Delete message using model factory
            await ModelFactory.broadcastMessage.delete(id);

            // Log audit event for message deletion
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

            return true;
        } catch (error) {
            log.error('Failed to delete broadcast message', { id, error: String(error) });
            throw error;
        }
    }
}

export const broadcastMessageService = new BroadcastMessageService();
