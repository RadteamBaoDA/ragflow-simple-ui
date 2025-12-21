import { config } from '../config';
import { User } from '../hooks/useAuth';

export const userService = {
    async getUsers(): Promise<User[]> {
        const response = await fetch(`${config.apiBaseUrl}/api/users`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch users');
        const data = await response.json();
        return data.map((user: any) => ({
            ...user,
            displayName: user.display_name || user.displayName || user.name
        }));
    },

    async getAllUsers(): Promise<User[]> {
        // Alias for getUsers if needed, or same implementation
        return this.getUsers();
    },

    async updateUserPermissions(userId: string, permissions: string[]): Promise<void> {
        const response = await fetch(`${config.apiBaseUrl}/api/users/${userId}/permissions`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ permissions })
        });
        if (!response.ok) throw new Error('Failed to update user permissions');
    }
};
