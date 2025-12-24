/**
 * @fileoverview Team management service.
 * 
 * Handles CRUD operations for teams and user-team membership management.
 * 
 * @module services/team
 */

import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '@/db/index.js';
import { log } from '@/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Team {
    id: string;
    name: string;
    project_name?: string | null;
    description?: string | null;
    created_at: string;
    updated_at: string;
}

export interface UserTeam {
    user_id: string;
    team_id: string;
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

// ============================================================================
// TEAM SERVICE CLASS
// ============================================================================

export class TeamService {
    /**
     * Create a new team.
     */
    async createTeam(data: CreateTeamDTO, user?: { id: string, email: string, ip?: string }): Promise<Team> {
        const id = uuidv4();
        const team = await queryOne<Team>(
            `INSERT INTO teams (id, name, project_name, description)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [id, data.name, data.project_name || null, data.description || null]
        );

        if (!team) throw new Error('Failed to create team');

        if (user) {
            await auditService.log({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.CREATE_TEAM,
                resourceType: AuditResourceType.TEAM,
                resourceId: team.id,
                details: { name: team.name },
                ipAddress: user.ip,
            });
        }

        return team;
    }

    /**
     * Get all teams.
     */
    async getAllTeams(): Promise<Team[]> {
        return query<Team>('SELECT * FROM teams ORDER BY created_at DESC');
    }

    /**
     * Get a team by ID.
     */
    async getTeam(id: string): Promise<Team | undefined> {
        return queryOne<Team>('SELECT * FROM teams WHERE id = $1', [id]);
    }

    /**
     * Update a team.
     */
    async updateTeam(id: string, data: UpdateTeamDTO, user?: { id: string, email: string, ip?: string }): Promise<Team | undefined> {
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.project_name !== undefined) {
            updates.push(`project_name = $${paramIndex++}`);
            values.push(data.project_name);
        }
        if (data.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(data.description);
        }

        if (updates.length === 0) return this.getTeam(id);

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const updatedTeam = await queryOne<Team>(
            `UPDATE teams SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (user && updatedTeam) {
            await auditService.log({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.UPDATE_TEAM,
                resourceType: AuditResourceType.TEAM,
                resourceId: updatedTeam.id,
                details: { changes: data },
                ipAddress: user.ip,
            });
        }

        return updatedTeam;
    }

    /**
     * Delete a team.
     */
    async deleteTeam(id: string, user?: { id: string, email: string, ip?: string }): Promise<void> {
        // Fetch team details before deletion for audit logging
        const team = await this.getTeam(id);

        await query('DELETE FROM teams WHERE id = $1', [id]);

        if (user) {
            await auditService.log({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.DELETE_TEAM,
                resourceType: AuditResourceType.TEAM,
                resourceId: id,
                details: { teamName: team?.name },
                ipAddress: user.ip,
            });
        }
    }

    /**
     * Add a user to a team.
     */
    async addUserToTeam(
        teamId: string,
        userId: string,
        role: 'member' | 'leader' = 'member',
        actor?: { id: string, email: string, ip?: string }
    ): Promise<void> {
        await query(
            `INSERT INTO user_teams (user_id, team_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, team_id) DO UPDATE SET role = $3`,
            [userId, teamId, role]
        );

        if (actor) {
            await auditService.log({
                userId: actor.id,
                userEmail: actor.email,
                action: AuditAction.UPDATE_TEAM,
                resourceType: AuditResourceType.TEAM,
                resourceId: teamId,
                details: { action: 'add_member', targetUserId: userId, role },
                ipAddress: actor.ip,
            });
        }
    }

    /**
     * Remove a user from a team.
     */
    async removeUserFromTeam(teamId: string, userId: string, actor?: { id: string, email: string, ip?: string }): Promise<void> {
        await query(
            'DELETE FROM user_teams WHERE team_id = $1 AND user_id = $2',
            [teamId, userId]
        );

        if (actor) {
            await auditService.log({
                userId: actor.id,
                userEmail: actor.email,
                action: AuditAction.UPDATE_TEAM,
                resourceType: AuditResourceType.TEAM,
                resourceId: teamId,
                details: { action: 'remove_member', targetUserId: userId },
                ipAddress: actor.ip,
            });
        }
    }

    /**
     * Get users in a team.
     */
    async getTeamMembers(teamId: string): Promise<any[]> {
        return query(
            `SELECT u.id, u.email, u.display_name, ut.role, ut.joined_at
             FROM users u
             JOIN user_teams ut ON u.id = ut.user_id
             WHERE ut.team_id = $1
             ORDER BY ut.role DESC, u.display_name ASC`,
            [teamId]
        );
    }

    /**
     * Get teams for a specific user.
     */
    async getUserTeams(userId: string): Promise<Team[]> {
        return query<Team>(
            `SELECT t.* 
             FROM teams t
             JOIN user_teams ut ON t.id = ut.team_id
             WHERE ut.user_id = $1
             ORDER BY t.name ASC`,
            [userId]
        );
    }


    /**
     * Add multiple members to a team with automatic role assignment.
     * 
     * Logic:
     * - Global 'admin' -> Throw error (Cannot be added to teams)
     * - Global 'leader' -> Team 'leader'
     * - Global 'user' -> Team 'member'
     */
    async addMembersWithAutoRole(teamId: string, userIds: string[], actor?: { id: string, email: string, ip?: string }): Promise<void> {
        if (!userIds || userIds.length === 0) return;

        // 1. Get users' global roles
        // We use ANY($1) for array matching in Postgres
        const users = await query<{ id: string, role: string }>(
            'SELECT id, role FROM users WHERE id = ANY($1)',
            [userIds]
        );

        if (users.length === 0) {
            throw new Error('No valid users found');
        }

        // 2. Check for admin role
        const admins = users.filter(u => u.role === 'admin');
        if (admins.length > 0) {
            throw new Error('Administrators cannot be added to teams');
        }

        // 3. Add users to team in parallel
        await Promise.all(users.map(user => {
            const teamRole = user.role === 'leader' ? 'leader' : 'member';
            return this.addUserToTeam(teamId, user.id, teamRole, actor);
        }));
    }

    /**
     * Grant permissions to all members of a team.
     * Merges new permissions with existing ones for each user.
     */
    async grantPermissionsToTeam(teamId: string, permissionsToGrant: string[], actor?: { id: string, email: string, ip?: string }): Promise<void> {
        // 1. Get all team members
        const members = await this.getTeamMembers(teamId);

        if (members.length === 0) return;

        // 2. Get full user records to access current permissions
        // We need to fetch users one by one or via IN clause to get their current 'permissions' column
        // getTeamMembers only returns basic info joined from user_teams
        const { userService } = await import('./user.service.js'); // Lazy import to avoid circular dependency

        // Process in parallel
        await Promise.all(members.map(async (member) => {
            // Skip admins - they already have full access
            // (Standard members have role 'user' or 'leader')

            // Fetch current user data
            const user = await queryOne<{ id: string, role: string, permissions: string | string[] }>(
                'SELECT id, role, permissions FROM users WHERE id = $1',
                [member.id]
            );

            if (!user || user.role === 'admin') return;

            // Parse existing permissions
            let currentPermissions: string[] = [];
            if (typeof user.permissions === 'string') {
                currentPermissions = JSON.parse(user.permissions);
            } else if (Array.isArray(user.permissions)) {
                currentPermissions = user.permissions;
            }

            // Merge new permissions (Set union)
            const newPermissionsSet = new Set([...currentPermissions, ...permissionsToGrant]);
            const newPermissions = Array.from(newPermissionsSet);

            // Update if changed
            if (newPermissions.length !== currentPermissions.length) {
                await userService.updateUserPermissions(user.id, newPermissions, actor);
            }
        }));
    }
}

export const teamService = new TeamService();
