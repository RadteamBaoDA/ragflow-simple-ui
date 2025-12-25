
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { DocumentPermission, PermissionLevel } from '@/models/types.js';

export { PermissionLevel };

export class DocumentPermissionService {
    /**
     * Retrieves the permission level for a specific entity on a bucket.
     *
     * @param entityType - The type of entity (e.g., 'user', 'team').
     * @param entityId - The ID of the entity.
     * @param bucketId - The ID of the bucket.
     * @returns A promise that resolves to the permission level (default: NONE).
     */
    async getPermission(entityType: string, entityId: string, bucketId: string): Promise<PermissionLevel> {
        const result = await ModelFactory.documentPermission.findByEntityAndBucket(entityType, entityId, bucketId);
        return (result?.permission_level as unknown as PermissionLevel) ?? PermissionLevel.NONE;
    }

    /**
     * Sets the permission level for a specific entity on a bucket and logs the action.
     *
     * @param entityType - The type of entity.
     * @param entityId - The ID of the entity.
     * @param bucketId - The ID of the bucket.
     * @param level - The permission level to set.
     * @param actor - The user performing the action (optional, for audit).
     * @returns A promise that resolves when the permission is set.
     * @throws Error if the operation fails.
     */
    async setPermission(
        entityType: string,
        entityId: string,
        bucketId: string,
        level: PermissionLevel,
        actor?: { id: string, email: string, ip?: string }
    ): Promise<void> {
        try {
            const existing = await ModelFactory.documentPermission.findByEntityAndBucket(entityType, entityId, bucketId);
            if (existing) {
                await ModelFactory.documentPermission.update(existing.id, { permission_level: level });
            } else {
                await ModelFactory.documentPermission.create({
                    entity_type: entityType,
                    entity_id: entityId,
                    bucket_id: bucketId,
                    permission_level: level
                });
            }

            if (actor) {
                await auditService.log({
                    userId: actor.id,
                    userEmail: actor.email,
                    action: AuditAction.SET_PERMISSION,
                    resourceType: AuditResourceType.PERMISSION,
                    resourceId: `${entityType}:${entityId}:${bucketId}`,
                    details: { entityType, entityId, bucketId, level },
                    ipAddress: actor.ip,
                });
            }
        } catch (error) {
            log.error('Failed to set permission', { error: String(error) });
            throw error;
        }
    }

    /**
     * Resolves the effective permission level for a user on a bucket.
     * Considers individual user permissions, team memberships (if user is leader), and admin status.
     *
     * @param userId - The ID of the user.
     * @param bucketId - The ID of the bucket.
     * @returns A promise that resolves to the highest applicable permission level.
     */
    async resolveUserPermission(userId: string, bucketId: string): Promise<PermissionLevel> {
        // Superuser bypass: Admins always have FULL access
        const user = await ModelFactory.user.findById(userId);
        if (user?.role === 'admin') {
            return PermissionLevel.FULL;
        }

        const userPerm = await this.getPermission('user', userId, bucketId);

        // Get teams where user is leader
        // Assuming findByUserId returns UserTeams, need to filter by role manually or if model supports
        const userTeams = await ModelFactory.userTeam.findAll({
            user_id: userId, role: 'leader'
        });

        const teamIds = userTeams.map((ut: any) => ut.team_id);

        if (teamIds.length === 0) return userPerm;

        let maxPerm = userPerm;

        for (const teamId of teamIds) {
            const teamPerm = await this.getPermission('team', teamId, bucketId);
            if (teamPerm > maxPerm) {
                maxPerm = teamPerm;
            }
        }

        return maxPerm;
    }

    /**
     * Retrieves all permissions associated with a specific bucket.
     *
     * @param bucketId - The ID of the bucket.
     * @returns A promise that resolves to a list of permissions.
     */
    async getPermissions(bucketId: string): Promise<DocumentPermission[]> {
        return ModelFactory.documentPermission.findAll({ bucket_id: bucketId });
    }

    /**
     * Sets multiple permissions for a bucket in a batch operation.
     *
     * @param bucketId - The ID of the bucket.
     * @param permissions - An array of permission objects to set.
     * @param actor - The user performing the action (optional, for audit).
     * @returns A promise that resolves when all permissions are processed.
     */
    async setPermissions(bucketId: string, permissions: any[], actor?: { id: string, email: string, ip?: string }): Promise<void> {
        if (!Array.isArray(permissions)) return;

        await Promise.all(permissions.map(p =>
            this.setPermission(p.entityType, p.entityId, bucketId, p.level, actor)
        ));
    }

    /**
     * Retrieves all permissions, optionally filtered by bucket.
     * Alias for getPermissions if bucketId is provided.
     *
     * @param bucketId - The ID of the bucket (optional).
     * @returns A promise that resolves to a list of permissions.
     */
    async getAllPermissions(bucketId?: string): Promise<DocumentPermission[]> {
        if (bucketId) return this.getPermissions(bucketId);
        return ModelFactory.documentPermission.findAll();
    }
}

export const documentPermissionService = new DocumentPermissionService();
