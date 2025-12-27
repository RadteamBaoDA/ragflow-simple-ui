/**
 * @fileoverview Team management service.
 * 
 * Handles CRUD operations for teams and user-team membership management.
 * Uses ModelFactory for all database operations following the Factory Pattern.
 * 
 * @module services/team
 */

import { v4 as uuidv4 } from 'uuid';
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { Team } from '@/models/types.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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
     * @param data - Team creation data (name, project, description).
     * @param user - User context for audit logging.
     * @returns Promise<Team> - The created Team object.
     * @throws Error if creation fails.
     * @description Creates a team record and logs the action.
     */
    async createTeam(data: CreateTeamDTO, user?: { id: string, email: string, ip?: string }): Promise<Team> {
        const id = uuidv4();

        // Create team using model factory
        const team = await ModelFactory.team.create({
            id,
            name: data.name,
            project_name: data.project_name || null,
            description: data.description || null
        });

        if (!team) throw new Error('Failed to create team');

        // Log audit event for team creation
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
     * Get all teams ordered by creation date.
     * @returns Promise<Team[]> - List of all teams.
     * @description Fetches all teams sorted by created_at desc.
     */
    async getAllTeams(): Promise<Team[]> {
        return ModelFactory.team.findAll({}, { orderBy: { created_at: 'desc' } });
    }

    /**
     * Get a team by ID.
     * @param id - Team ID.
     * @returns Promise<Team | undefined> - Team object or undefined if not found.
     * @description Retrieves a single team record.
     */
    async getTeam(id: string): Promise<Team | undefined> {
        return ModelFactory.team.findById(id);
    }

    /**
     * Update a team.
     * @param id - Team ID.
     * @param data - Update payload.
     * @param user - User context for audit logging.
     * @returns Promise<Team | undefined> - Updated team object.
     * @description Updates team details and logs the action.
     */
    async updateTeam(id: string, data: UpdateTeamDTO, user?: { id: string, email: string, ip?: string }): Promise<Team | undefined> {
        // Build update data object with only defined fields
        const updateData: Partial<Team> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.project_name !== undefined) updateData.project_name = data.project_name;
        if (data.description !== undefined) updateData.description = data.description;

        // Return existing team if no changes
        if (Object.keys(updateData).length === 0) return this.getTeam(id);

        // Update team using model factory
        const updatedTeam = await ModelFactory.team.update(id, updateData);

        // Log audit event for team update
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
     * @param id - Team ID.
     * @param user - User context for audit logging.
     * @returns Promise<void>
     * @description Removes a team and logs the action.
     */
    async deleteTeam(id: string, user?: { id: string, email: string, ip?: string }): Promise<void> {
        // Fetch team details before deletion for audit logging
        const team = await this.getTeam(id);

        // Delete team using model factory
        await ModelFactory.team.delete(id);

        // Log audit event for team deletion
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
     * Add a user to a team (or update role if already member).
     * @param teamId - Team ID.
     * @param userId - User ID.
     * @param role - Role ('member' or 'leader').
     * @param actor - Actor context for audit logging.
     * @returns Promise<void>
     * @description Upserts user-team membership and logs action.
     */
    async addUserToTeam(
        teamId: string,
        userId: string,
        role: 'member' | 'leader' = 'member',
        actor?: { id: string, email: string, ip?: string }
    ): Promise<void> {
        // Upsert user-team membership using model factory
        await ModelFactory.userTeam.upsert(userId, teamId, role);

        // Log audit event for member addition
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
     * @param teamId - Team ID.
     * @param userId - User ID to remove.
     * @param actor - Actor context for audit logging.
     * @returns Promise<void>
     * @description Deletes user-team membership and logs action.
     */
    async removeUserFromTeam(teamId: string, userId: string, actor?: { id: string, email: string, ip?: string }): Promise<void> {
        // Delete user-team membership using model factory
        await ModelFactory.userTeam.deleteByUserAndTeam(userId, teamId);

        // Log audit event for member removal
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
     * Get users in a team with their membership roles.
     * @param teamId - Team ID.
     * @returns Promise<any[]> - List of members with user details.
     * @description Wraps model method to join users and user_teams.
     */
    async getTeamMembers(teamId: string): Promise<any[]> {
        return ModelFactory.userTeam.findMembersByTeamId(teamId);
    }

    /**
     * Get teams for a specific user.
     * @param userId - User ID.
     * @returns Promise<Team[]> - List of teams the user belongs to.
     * @description Wraps model method to find teams by user.
     */
    async getUserTeams(userId: string): Promise<Team[]> {
        return ModelFactory.userTeam.findTeamsWithDetailsByUserId(userId);
    }


    /**
     * Add multiple members to a team with automatic role assignment.
     * @param teamId - Team ID.
     * @param userIds - Array of user IDs to add.
     * @param actor - Actor context for audit logging.
     * @returns Promise<void>
     * @throws Error if no users found or if admin is included.
     * @description Maps global roles to team roles (leader->leader, user->member) and adds qualified users.
     */
    async addMembersWithAutoRole(teamId: string, userIds: string[], actor?: { id: string, email: string, ip?: string }): Promise<void> {
        if (!userIds || userIds.length === 0) return;

        // Get users' global roles using model factory
        const users = await ModelFactory.userTeam.findUsersByIds(userIds);

        if (users.length === 0) {
            throw new Error('No valid users found');
        }

        // Check for admin role - admins cannot be added to teams
        const admins = users.filter(u => u.role === 'admin');
        if (admins.length > 0) {
            throw new Error('Administrators cannot be added to teams');
        }

        // Add users to team in parallel with role mapping
        await Promise.all(users.map(user => {
            const teamRole = user.role === 'leader' ? 'leader' : 'member';
            return this.addUserToTeam(teamId, user.id, teamRole, actor);
        }));
    }

    /**
     * Grant permissions to all members of a team.
     * @param teamId - Team ID.
     * @param permissionsToGrant - Array of permissions strings.
     * @param actor - Actor context for audit logging.
     * @returns Promise<void>
     * @description Iterates all team members and merges new permissions into their user profile.
     */
    async grantPermissionsToTeam(teamId: string, permissionsToGrant: string[], actor?: { id: string, email: string, ip?: string }): Promise<void> {
        // Get all team members
        const members = await this.getTeamMembers(teamId);

        if (members.length === 0) return;

        // Lazy import to avoid circular dependency
        const { userService } = await import('./user.service.js');

        // Process each member in parallel
        await Promise.all(members.map(async (member) => {
            // Fetch current user data using model factory
            const user = await ModelFactory.user.findById(member.id);

            // Skip admins - they already have full access
            if (!user || user.role === 'admin') return;

            // Parse existing permissions (handle both string and array formats)
            let currentPermissions: string[] = [];
            if (typeof user.permissions === 'string') {
                currentPermissions = JSON.parse(user.permissions);
            } else if (Array.isArray(user.permissions)) {
                currentPermissions = user.permissions;
            }

            // Merge new permissions using Set union
            const newPermissionsSet = new Set([...currentPermissions, ...permissionsToGrant]);
            const newPermissions = Array.from(newPermissionsSet);

            // Update if permissions changed
            if (newPermissions.length !== currentPermissions.length) {
                await userService.updateUserPermissions(user.id, newPermissions, actor);
            }
        }));
    }
}

export const teamService = new TeamService();
