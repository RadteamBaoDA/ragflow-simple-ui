import { config } from '@/config';

export interface Team {
    id: string;
    name: string;
    project_name?: string;
    description?: string;
    created_at: string;
    updated_at: string;
}

export interface TeamMember {
    id: string;
    email: string;
    display_name: string;
    role: 'member' | 'leader';
    joined_at: string;
}

export interface CreateTeamDTO {
    name: string;
    project_name?: string;
    description?: string;
}

export interface UpdateTeamDTO {
    name?: string;
    project_name?: string;
    description?: string;
}

export const teamService = {
    async getTeams(): Promise<Team[]> {
        const response = await fetch(`${config.apiBaseUrl}/api/teams`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch teams');
        return response.json();
    },

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
