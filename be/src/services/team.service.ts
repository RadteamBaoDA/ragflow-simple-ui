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
     * Uses ModelFactory.team.create() for database insertion.
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
     * Uses ModelFactory.team.findAll() with ordering.
     */
    async getAllTeams(): Promise<Team[]> {
        return ModelFactory.team.findAll({}, { orderBy: { created_at: 'desc' } });
    }

    /**
     * Get a team by ID.
     * Uses ModelFactory.team.findById() for single record lookup.
     */
    async getTeam(id: string): Promise<Team | undefined> {
        return ModelFactory.team.findById(id);
    }

    /**
     * Update a team.
     * Uses ModelFactory.team.update() for partial updates.
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
     * Uses ModelFactory.team.delete() for removal.
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
     * Uses ModelFactory.userTeam.upsert() for INSERT ON CONFLICT.
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
     * Uses ModelFactory.userTeam.deleteByUserAndTeam().
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
     * Uses ModelFactory.userTeam.findMembersByTeamId() for JOIN query.
     */
    async getTeamMembers(teamId: string): Promise<any[]> {
        return ModelFactory.userTeam.findMembersByTeamId(teamId);
    }

    /**
     * Get teams for a specific user.
     * Uses ModelFactory.userTeam.findTeamsWithDetailsByUserId() for JOIN query.
     */
    async getUserTeams(userId: string): Promise<Team[]> {
        return ModelFactory.userTeam.findTeamsWithDetailsByUserId(userId);
    }


    /**
     * Add multiple members to a team with automatic role assignment.
     * 
     * Role mapping logic:
     * - Global 'admin' -> Throw error (Cannot be added to teams)
     * - Global 'leader' -> Team 'leader'
     * - Global 'user' -> Team 'member'
     * 
     * Uses ModelFactory.userTeam.findUsersByIds() for batch user lookup.
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
     * Merges new permissions with existing ones for each user.
     * 
     * Uses ModelFactory.user.findById() for individual user lookup.
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
