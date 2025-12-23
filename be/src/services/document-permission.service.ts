import { query, queryOne } from '../db/index.js';
import { log } from './logger.service.js';

export enum PermissionLevel {
    NONE = 0,
    VIEW = 1,
    UPLOAD = 2,
    FULL = 3
}

export interface DocumentPermission {
    id: string;
    entity_type: 'user' | 'team';
    entity_id: string;
    bucket_id: string;
    permission_level: PermissionLevel;
    created_at: string;
    updated_at: string;
}

export class DocumentPermissionService {
    /**
     * Get permission level for a specific entity.
     */
    async getPermission(entityType: 'user' | 'team', entityId: string, bucketId: string): Promise<PermissionLevel> {
        const result = await queryOne<{ permission_level: number }>(
            'SELECT permission_level FROM document_permissions WHERE entity_type::text = $1::text AND entity_id::text = $2::text AND bucket_id::text = $3::text',
            [entityType, entityId, bucketId]
        );
        return result?.permission_level ?? PermissionLevel.NONE;
    }

    /**
     * Set permission level for an entity.
     */
    async setPermission(entityType: 'user' | 'team', entityId: string, bucketId: string, level: PermissionLevel): Promise<void> {
        await query(
            `INSERT INTO document_permissions (entity_type, entity_id, bucket_id, permission_level, updated_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (entity_type, entity_id, bucket_id)
             DO UPDATE SET permission_level = $4, updated_at = NOW()`,
            [entityType, entityId, bucketId, level]
        );
    }

    /**
     * Resolve effective permission for a user.
     * Considers user's direct permission AND permissions of teams they lead.
     * Members do NOT inherit team permissions.
     */
    async resolveUserPermission(userId: string, bucketId: string): Promise<PermissionLevel> {
        // 1. Get user's direct permission for this bucket
        const userPerm = await this.getPermission('user', userId, bucketId);

        // 2. Get permissions of teams where user is a LEADER for this bucket
        const teamPerms = await query<{ permission_level: number }>(
            `SELECT sp.permission_level
             FROM document_permissions sp
             JOIN user_teams ut ON sp.entity_id::text = ut.team_id::text
             WHERE sp.entity_type::text = 'team'
               AND sp.bucket_id::text = $2::text
               AND ut.user_id::text = $1::text
               AND ut.role::text = 'leader'`,
            [userId, bucketId]
        );

        // 3. Return the maximum permission level
        let maxPerm = userPerm;
        for (const p of teamPerms) {
            if (p.permission_level > maxPerm) {
                maxPerm = p.permission_level;
            }
        }

        return maxPerm;
    }

    /**
     * Get all permissions (for admin UI).
     */
    async getAllPermissions(bucketId?: string): Promise<DocumentPermission[]> {
        if (bucketId) {
            return query<DocumentPermission>('SELECT * FROM document_permissions WHERE bucket_id::text = $1::text', [bucketId]);
        }
        return query<DocumentPermission>('SELECT * FROM document_permissions');
    }
}

export const documentPermissionService = new DocumentPermissionService();
