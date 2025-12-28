
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { PermissionLevel } from '@/models/types.js';

export class PromptPermissionService {
    /**
     * Lookup permission for a single entity.
     * @param entityType - 'user' or 'team'.
     * @param entityId - The ID of the user or team.
     * @returns Promise<PermissionLevel> - The permission level.
     */
    async getPermission(entityType: string, entityId: string): Promise<PermissionLevel> {
        const result = await ModelFactory.promptPermission.findByEntity(entityType, entityId);
        return (result?.permission_level as unknown as PermissionLevel) ?? PermissionLevel.NONE;
    }

    /**
     * Set permission for an entity.
     */
    async setPermission(
        entityType: string,
        entityId: string,
        level: PermissionLevel,
        actor?: { id: string, email: string, ip?: string }
    ): Promise<void> {
        try {
            const existing = await ModelFactory.promptPermission.findByEntity(entityType, entityId);

            if (existing) {
                await ModelFactory.promptPermission.update(existing.id, {
                    permission_level: level,
                    updated_by: actor?.id || null
                });
            } else {
                await ModelFactory.promptPermission.create({
                    entity_type: entityType,
                    entity_id: entityId,
                    permission_level: level,
                    created_by: actor?.id || null,
                    updated_by: actor?.id || null
                });
            }

            if (actor) {
                await auditService.log({
                    userId: actor.id,
                    userEmail: actor.email,
                    action: AuditAction.SET_PERMISSION,
                    resourceType: AuditResourceType.PROMPT,
                    resourceId: `prompt:${entityType}:${entityId}`,
                    details: { entityType, entityId, level },
                    ipAddress: actor.ip,
                });
            }
        } catch (error) {
            log.error('Failed to set prompt permission', { error: String(error) });
            throw error;
        }
    }

    /**
     * Resolve effective permission for a user.
     */
    async resolveUserPermission(userId: string): Promise<PermissionLevel> {
        const user = await ModelFactory.user.findById(userId);
        if (user?.role === 'admin') {
            return PermissionLevel.FULL;
        }

        const userPerm = await this.getPermission('user', userId);

        const userTeams = await ModelFactory.userTeam.findAll({
            user_id: userId, role: 'leader'
        });

        const teamIds = userTeams.map((ut: any) => ut.team_id);
        if (teamIds.length === 0) return userPerm;

        let maxPerm = userPerm;

        for (const teamId of teamIds) {
            const teamPerm = await this.getPermission('team', teamId);
            if (teamPerm > maxPerm) {
                maxPerm = teamPerm;
            }
        }

        return maxPerm;
    }

    /**
     * List all prompt permissions.
     */
    async getAllPermissions(): Promise<any[]> {
        return ModelFactory.promptPermission.findAll();
    }
}

export const promptPermissionService = new PromptPermissionService();
