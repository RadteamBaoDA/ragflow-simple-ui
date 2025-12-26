/**
 * @fileoverview Service for interacting with the broadcast message API.
 */

import { BroadcastMessage } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * @description Service object containing methods for CRUD operations on broadcast messages.
 */
export const broadcastMessageService = {
    /**
     * @description Get all currently active broadcast messages.
     * Use this for displaying banners to end users.
     *
     * @returns {Promise<BroadcastMessage[]>} List of active broadcast messages.
     * @throws {Error} If the fetch fails.
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
     * @description Get all broadcast messages regardless of status.
     * Intended for admin use.
     *
     * @returns {Promise<BroadcastMessage[]>} List of all broadcast messages.
     * @throws {Error} If the fetch fails.
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
     * @description Create a new broadcast message.
     *
     * @param {Omit<BroadcastMessage, 'id' | 'created_at' | 'updated_at'>} data - The message data to create.
     * @returns {Promise<BroadcastMessage>} The created message.
     * @throws {Error} If creation fails.
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
     * @description Update an existing broadcast message.
     *
     * @param {string} id - The ID of the message to update.
     * @param {Partial<Omit<BroadcastMessage, 'id' | 'created_at' | 'updated_at'>>} data - The fields to update.
     * @returns {Promise<BroadcastMessage>} The updated message.
     * @throws {Error} If update fails.
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
     * @description Delete a broadcast message.
     *
     * @param {string} id - The ID of the message to delete.
     * @returns {Promise<void>}
     * @throws {Error} If deletion fails.
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
     * @description Record a message dismissal for the current user.
     * Prevents the message from showing again for this user on this device.
     *
     * @param {string} id - The ID of the message to dismiss.
     * @returns {Promise<void>}
     * @throws {Error} If the API call fails.
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
