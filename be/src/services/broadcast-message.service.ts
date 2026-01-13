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
     * @param userId - Optional User ID to filter out dismissed messages.
     * @returns Promise<BroadcastMessage[]> - List of active messages.
     * @description Fetches messages that are currently active, optionally excluding those dismissed by the user.
     */
    async getActiveMessages(userId?: string): Promise<BroadcastMessage[]> {
        try {
            // Get current timestamp
            const now = new Date().toISOString();

            if (userId) {
                // Return active messages NOT dismissed by this user within last 24h
                return ModelFactory.broadcastMessage.findActiveExcludingDismissed(userId, now);
            } else {
                // Return all active messages (for guests/login page)
                return ModelFactory.broadcastMessage.findActive(now);
            }
        } catch (error) {
            // Log error and rethrow
            log.error('Failed to fetch active broadcast messages', { userId, error: String(error) });
            throw error;
        }
    }

    /**
     * Record a message dismissal for a user.
     * @param userId - The ID of the user.
     * @param broadcastId - The ID of the broadcast message.
     * @param userEmail - Optional email for audit log.
     * @param ipAddress - Optional IP address for audit log.
     * @returns Promise<void>
     * @description Marks a message as dismissed for a specific user and logs the action.
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
            // Log error and rethrow
            log.error('Failed to dismiss broadcast message', { userId, broadcastId, error: String(error) });
            throw error;
        }
    }

    /**
     * Get all broadcast messages (admin only).
     * @returns Promise<BroadcastMessage[]> - List of all messages.
     * @description Fetches all broadcast messages ordered by creation date.
     */
    async getAllMessages(): Promise<BroadcastMessage[]> {
        try {
            // Fetch all messages via model factory
            return ModelFactory.broadcastMessage.findAll({}, { orderBy: { created_at: 'desc' } });
        } catch (error) {
            // Log error and rethrow
            log.error('Failed to fetch all broadcast messages', { error: String(error) });
            throw error;
        }
    }

    /**
     * Create a new broadcast message.
     * @param data - The message data.
     * @param user - Optional user context for audit.
     * @returns Promise<BroadcastMessage> - The created message.
     * @description Creates a new broadcast message and logs the action.
     */
    async createMessage(
        data: Omit<BroadcastMessage, 'id' | 'created_at' | 'updated_at'>,
        user?: { id: string, email: string, ip?: string }
    ): Promise<BroadcastMessage> {
        try {
            // Create message using model factory with defaults
            const message = await ModelFactory.broadcastMessage.create({
                message: data.message,
                starts_at: data.starts_at,
                ends_at: data.ends_at,
                color: data.color || '#E75E40',
                font_color: data.font_color || '#FFFFFF',
                is_active: data.is_active === undefined ? true : data.is_active,
                is_dismissible: data.is_dismissible === undefined ? false : data.is_dismissible,
                created_by: user?.id || null,
                updated_by: user?.id || null
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
            // Log error and rethrow
            log.error('Failed to create broadcast message', { error: String(error) });
            throw error;
        }
    }

    /**
     * Update an existing broadcast message.
     * @param id - The ID of the message to update.
     * @param data - The data to update.
     * @param user - Optional user context for audit.
     * @returns Promise<BroadcastMessage | null> - The updated message or null.
     * @description Updates a broadcast message and logs the action.
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

            // Add updated_by after checking for fields to update
            if (user) updateData.updated_by = user.id;

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
            // Log error and rethrow
            log.error('Failed to update broadcast message', { id, error: String(error) });
            throw error;
        }
    }

    /**
     * Delete a broadcast message.
     * @param id - The ID of the message to delete.
     * @param user - Optional user context for audit.
     * @returns Promise<boolean> - True if deleted successfully.
     * @description Deletes a broadcast message and logs the action.
     */
    async deleteMessage(id: string, user?: { id: string, email: string, ip?: string }): Promise<boolean> {
        try {
            // Fetch message before deletion for audit logging details
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
            // Log error and rethrow
            log.error('Failed to delete broadcast message', { id, error: String(error) });
            throw error;
        }
    }
}

export const broadcastMessageService = new BroadcastMessageService();
