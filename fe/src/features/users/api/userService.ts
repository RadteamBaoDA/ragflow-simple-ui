import { config } from '@/config';
import { User } from '@/features/auth';

// Thin fetch wrapper for user listing and permission updates.
export const userService = {
    // Fetch users filtered by roles (session cookie + optional bearer token).
    async getUsers(roles?: string[]): Promise<User[]> {
        const queryParams = roles ? `?roles=${roles.join(',')}` : '';
        const response = await fetch(`${config.apiBaseUrl}/api/users${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch users');
        const data = await response.json();
        return data.map((user: any) => ({
            ...user,
            displayName: user.display_name || user.displayName || user.name
        }));
    },

    // Alias to keep API symmetry when a full list is needed.
    async getAllUsers(roles?: string[]): Promise<User[]> {
        // Alias for getUsers if needed, or same implementation
        return this.getUsers(roles);
    },

    // Update permissions for a specific user.
    async updateUserPermissions(userId: string, permissions: string[]): Promise<void> {
        const response = await fetch(`${config.apiBaseUrl}/api/users/${userId}/permissions`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            credentials: 'include',
            body: JSON.stringify({ permissions })
        });
        if (!response.ok) throw new Error('Failed to update user permissions');
    }
};
