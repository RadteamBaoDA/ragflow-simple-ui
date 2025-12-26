
// Resolves and mutates document/bucket permission records for users and teams.
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { DocumentPermission, PermissionLevel } from '@/models/types.js';

export { PermissionLevel };

export class DocumentPermissionService {
    /**
     * Lookup permission for a single entity/bucket pair.
     * @param entityType - 'user' or 'team'.
     * @param entityId - The ID of the user or team.
     * @param bucketId - The ID of the bucket.
     * @returns Promise<PermissionLevel> - The permission level (NONE, READ, WRITE, etc).
     * @description Fetches direct permission setting for an entity on a specific bucket.
     */
    async getPermission(entityType: string, entityId: string, bucketId: string): Promise<PermissionLevel> {
        // Query database for permission record
        const result = await ModelFactory.documentPermission.findByEntityAndBucket(entityType, entityId, bucketId);
        // Return level or default to NONE
        return (result?.permission_level as unknown as PermissionLevel) ?? PermissionLevel.NONE;
    }

    /**
     * Upsert a permission row and optionally audit the actor.
     * @param entityType - 'user' or 'team'.
     * @param entityId - The ID of the target user or team.
     * @param bucketId - The ID of the bucket.
     * @param level - The permission level to set.
     * @param actor - Optional user context for audit logging.
     * @returns Promise<void>
     * @description Creates or updates a permission record and accepts an optional actor for audit logging.
     */
    async setPermission(
        entityType: string,
        entityId: string,
        bucketId: string,
        level: PermissionLevel,
        actor?: { id: string, email: string, ip?: string }
    ): Promise<void> {
        try {
            // Check if permission already exists
            const existing = await ModelFactory.documentPermission.findByEntityAndBucket(entityType, entityId, bucketId);

            if (existing) {
                // Update existing permission
                await ModelFactory.documentPermission.update(existing.id, { permission_level: level });
            } else {
                // Create new permission
                await ModelFactory.documentPermission.create({
                    entity_type: entityType,
                    entity_id: entityId,
                    bucket_id: bucketId,
                    permission_level: level
                });
            }

            // If actor provided, log audit event
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
            // Log error and rethrow
            log.error('Failed to set permission', { error: String(error) });
            throw error;
        }
    }

    /**
     * Combine direct user and leader team permissions (admins bypass to FULL).
     * @param userId - The ID of the user.
     * @param bucketId - The ID of the bucket.
     * @returns Promise<PermissionLevel> - The effective permission level.
     * @description Resolves the maximum permission level by checking admin role, direct user perm, and team leadership perms.
     */
    async resolveUserPermission(userId: string, bucketId: string): Promise<PermissionLevel> {
        // Superuser bypass: Admins always have FULL access
        const user = await ModelFactory.user.findById(userId);
        if (user?.role === 'admin') {
            return PermissionLevel.FULL;
        }

        // Get direct user permission
        const userPerm = await this.getPermission('user', userId, bucketId);

        // Get teams where user is leader
        // Assuming findByUserId returns UserTeams, need to filter by role manually or if model supports
        const userTeams = await ModelFactory.userTeam.findAll({
            user_id: userId, role: 'leader'
        });

        // Extract team IDs
        const teamIds = userTeams.map((ut: any) => ut.team_id);

        // If no teams, return direct permission
        if (teamIds.length === 0) return userPerm;

        let maxPerm = userPerm;

        // Iterate through teams to find max permission
        for (const teamId of teamIds) {
            const teamPerm = await this.getPermission('team', teamId, bucketId);
            // Upgrade permission if team has higher level
            if (teamPerm > maxPerm) {
                maxPerm = teamPerm;
            }
        }

        return maxPerm;
    }

    /**
     * List permissions scoped to a bucket.
     * @param bucketId - The ID of the bucket.
     * @returns Promise<DocumentPermission[]> - List of permissions.
     * @description Retrieves all permission records for a specific bucket.
     */
    async getPermissions(bucketId: string): Promise<DocumentPermission[]> {
        return ModelFactory.documentPermission.findAll({ bucket_id: bucketId });
    }

    /**
     * Batch apply permissions payload to a bucket.
     * @param bucketId - The ID of the bucket.
     * @param permissions - Array of permission objects to apply.
     * @param actor - Optional user context for audit.
     * @returns Promise<void>
     * @description Applies multiple permissions in parallel utilizing setPermission logic.
     */
    async setPermissions(bucketId: string, permissions: any[], actor?: { id: string, email: string, ip?: string }): Promise<void> {
        if (!Array.isArray(permissions)) return;

        // Execute all updates in parallel
        await Promise.all(permissions.map(p =>
            this.setPermission(p.entityType, p.entityId, bucketId, p.level, actor)
        ));
    }

    /**
     * Alias for controller compatibility if needed.
     * @param bucketId - Optional bucket ID filter.
     * @returns Promise<DocumentPermission[]> - List of permissions.
     * @description Compatibility helper to fetche all or bucket-scoped permissions.
     */
    async getAllPermissions(bucketId?: string): Promise<DocumentPermission[]> {
        if (bucketId) return this.getPermissions(bucketId);
        return ModelFactory.documentPermission.findAll();
    }
}

export const documentPermissionService = new DocumentPermissionService();
