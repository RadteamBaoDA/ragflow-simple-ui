/**
 * @fileoverview API service for team management.
 * Migrated from raw fetch to shared apiFetch utility.
 * @module features/teams/api/teamApi
 */
import { api } from '@/lib/api'
import type { Team, TeamMember, CreateTeamDTO, UpdateTeamDTO } from '../types/team.types'

const BASE_URL = '/api/teams'

export const teamApi = {
    /**
     * Fetch all teams the current user has access to.
     * @returns List of teams.
     */
    getTeams: (): Promise<Team[]> =>
        api.get<Team[]>(BASE_URL),

    /**
     * Create a new team.
     * @param data - Team creation payload.
     * @returns The created team.
     */
    createTeam: (data: CreateTeamDTO): Promise<Team> =>
        api.post<Team>(BASE_URL, data),

    /**
     * Update an existing team.
     * @param id - Team ID.
     * @param data - Update payload.
     * @returns Updated team.
     */
    updateTeam: (id: string, data: UpdateTeamDTO): Promise<Team> =>
        api.put<Team>(`${BASE_URL}/${id}`, data),

    /**
     * Delete a team.
     * @param id - Team ID.
     */
    deleteTeam: (id: string): Promise<void> =>
        api.delete<void>(`${BASE_URL}/${id}`),

    /**
     * Get members of a team.
     * @param teamId - Team ID.
     * @returns List of team members.
     */
    getTeamMembers: (teamId: string): Promise<TeamMember[]> =>
        api.get<TeamMember[]>(`${BASE_URL}/${teamId}/members`),

    /**
     * Add members to a team.
     * @param teamId - Team ID.
     * @param userIds - Array of user IDs to add.
     */
    addMembers: (teamId: string, userIds: string[]): Promise<void> =>
        api.post<void>(`${BASE_URL}/${teamId}/members`, { userIds }),

    /**
     * Remove a member from a team.
     * @param teamId - Team ID.
     * @param userId - User ID to remove.
     */
    removeMember: (teamId: string, userId: string): Promise<void> =>
        api.delete<void>(`${BASE_URL}/${teamId}/members/${userId}`),

    /**
     * Grant permissions to a team.
     * @param teamId - Team ID.
     * @param permissions - List of permission strings.
     */
    grantPermissions: (teamId: string, permissions: string[]): Promise<void> =>
        api.post<void>(`${BASE_URL}/${teamId}/permissions`, { permissions }),
}
