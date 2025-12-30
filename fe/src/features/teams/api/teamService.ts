/**
 * @fileoverview Service for managing teams and memberships.
 * Provides API functions for CRUD operations on teams and team members.
 */
import { config } from '@/config';

/**
 * Represents a Team entity.
 */
export interface Team {
    /** Unique team ID */
    id: string;
    /** Team Display Name */
    name: string;
    /** Optional project name associated with the team */
    project_name?: string;
    /** Team description */
    description?: string;
    /** ISO timestamp of creation */
    created_at: string;
    /** ISO timestamp of last update */
    updated_at: string;
    /** Number of members in the team */
    member_count?: number;
    /** Team leader info */
    leader?: {
        id: string;
        display_name: string;
        email: string;
    } | null;
}

/**
 * Represents a member within a team.
 */
export interface TeamMember {
    /** Member's User ID */
    id: string;
    /** Member's Email */
    email: string;
    /** Member's Display Name */
    display_name: string;
    /** Role within the team (member/leader) */
    role: 'member' | 'leader';
    /** ISO timestamp when user joined team */
    joined_at: string;
}

/**
 * Payload for creating a new team.
 */
export interface CreateTeamDTO {
    name: string;
    project_name?: string;
    description?: string;
}

/**
 * Payload for updating an existing team.
 */
export interface UpdateTeamDTO {
    name?: string;
    project_name?: string;
    description?: string;
}

export const teamService = {
    /**
     * Fetch all teams the current user has access to.
     * @returns List of teams
     */
    async getTeams(): Promise<Team[]> {
        const response = await fetch(`${config.apiBaseUrl}/api/teams`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            },
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch teams');
        return response.json();
    },

    /**
     * Create a new team.
     * @param data - Team creation data
     * @returns The created team
     */
    async createTeam(data: CreateTeamDTO): Promise<Team> {
        const response = await fetch(`${config.apiBaseUrl}/api/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to create team');
        return response.json();
    },

    /**
     * Update an existing team.
     * @param id - Team ID
     * @param data - Update data
     * @returns Updated team
     */
    async updateTeam(id: string, data: UpdateTeamDTO): Promise<Team> {
        const response = await fetch(`${config.apiBaseUrl}/api/teams/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update team');
        return response.json();
    },

    /**
     * Delete a team.
     * @param id - Team ID
     */
    async deleteTeam(id: string): Promise<void> {
        const response = await fetch(`${config.apiBaseUrl}/api/teams/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to delete team');
    },

    /**
     * Get members of a team.
     * @param teamId - Team ID
     * @returns List of team members
     */
    async getTeamMembers(teamId: string): Promise<TeamMember[]> {
        const response = await fetch(`${config.apiBaseUrl}/api/teams/${teamId}/members`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch team members');
        return response.json();
    },



    /**
     * Remove a member from a team.
     * @param teamId - Team ID
     * @param userId - User ID to remove
     */
    async removeMember(teamId: string, userId: string): Promise<void> {
        const response = await fetch(`${config.apiBaseUrl}/api/teams/${teamId}/members/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to remove member');
    },

    /**
     * Add members to a team.
     * @param teamId - Team ID
     * @param userIds - Array of User IDs to add
     */
    async addMembers(teamId: string, userIds: string[]): Promise<void> {
        const response = await fetch(`${config.apiBaseUrl}/api/teams/${teamId}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            credentials: 'include',
            body: JSON.stringify({ userIds })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to add members');
        }
    },

    /**
     * Grant permissions to a team (deprecated/placeholder, check specific implementation).
     * @param teamId - Team ID
     * @param permissions - List of permission strings
     */
    async grantPermissions(teamId: string, permissions: string[]): Promise<void> {
        const response = await fetch(`${config.apiBaseUrl}/api/teams/${teamId}/permissions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            credentials: 'include',
            body: JSON.stringify({ permissions })
        });
        if (!response.ok) throw new Error('Failed to grant permissions');
    }
};
