/**
 * @fileoverview Service for interacting with the broadcast message API.
 */

import { BroadcastMessage } from '../../../be/src/services/broadcast-message.service';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const broadcastMessageService = {
    /**
     * Get all currently active broadcast messages.
     */
    async getActiveMessages(): Promise<BroadcastMessage[]> {
        const response = await fetch(`${API_BASE_URL}/api/broadcast-messages/active`, {
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('Failed to fetch active broadcast messages');
        }
        return response.json();
    },

    /**
     * Get all broadcast messages (admin only).
     */
    async getAllMessages(): Promise<BroadcastMessage[]> {
        const response = await fetch(`${API_BASE_URL}/api/broadcast-messages`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error('Failed to fetch all broadcast messages');
        }
        return response.json();
    },

    /**
     * Create a new broadcast message.
     */
    async createMessage(data: Omit<BroadcastMessage, 'id' | 'created_at' | 'updated_at'>): Promise<BroadcastMessage> {
        const response = await fetch(`${API_BASE_URL}/api/broadcast-messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error('Failed to create broadcast message');
        }
        return response.json();
    },

    /**
     * Update an existing broadcast message.
     */
    async updateMessage(id: string, data: Partial<Omit<BroadcastMessage, 'id' | 'created_at' | 'updated_at'>>): Promise<BroadcastMessage> {
        const response = await fetch(`${API_BASE_URL}/api/broadcast-messages/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error('Failed to update broadcast message');
        }
        return response.json();
    },

    /**
     * Delete a broadcast message.
     */
    async deleteMessage(id: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/api/broadcast-messages/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('Failed to delete broadcast message');
        }
    },

    /**
     * Record a message dismissal for the current user.
     */
    async dismissMessage(id: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/api/broadcast-messages/${id}/dismiss`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('Failed to dismiss broadcast message');
        }
    }
};
