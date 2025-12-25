
// Resolves and mutates document/bucket permission records for users and teams.
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { DocumentPermission, PermissionLevel } from '@/models/types.js';

export { PermissionLevel };

export class DocumentPermissionService {
    // Lookup permission for a single entity/bucket pair
    async getPermission(entityType: string, entityId: string, bucketId: string): Promise<PermissionLevel> {
        const result = await ModelFactory.documentPermission.findByEntityAndBucket(entityType, entityId, bucketId);
        return (result?.permission_level as unknown as PermissionLevel) ?? PermissionLevel.NONE;
    }

    // Upsert a permission row and optionally audit the actor
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

    // Combine direct user and leader team permissions (admins bypass to FULL)
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

    // List permissions scoped to a bucket
    async getPermissions(bucketId: string): Promise<DocumentPermission[]> {
        return ModelFactory.documentPermission.findAll({ bucket_id: bucketId });
    }

    // Batch apply permissions payload to a bucket
    async setPermissions(bucketId: string, permissions: any[], actor?: { id: string, email: string, ip?: string }): Promise<void> {
        if (!Array.isArray(permissions)) return;

        await Promise.all(permissions.map(p =>
            this.setPermission(p.entityType, p.entityId, bucketId, p.level, actor)
        ));
    }

    // Alias for controller compat if needed
    // Compatibility helper for controllers to fetch all or bucket-scoped permissions
    async getAllPermissions(bucketId?: string): Promise<DocumentPermission[]> {
        if (bucketId) return this.getPermissions(bucketId);
        return ModelFactory.documentPermission.findAll();
    }
}

export const documentPermissionService = new DocumentPermissionService();
