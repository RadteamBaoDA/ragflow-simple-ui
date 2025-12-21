import { query, queryOne } from '../db/index.js';
import { log } from './logger.service.js';

export enum PermissionLevel {
    NONE = 0,
    VIEW = 1,
    UPLOAD = 2,
    FULL = 3
}

export interface StoragePermission {
    id: string;
    entity_type: 'user' | 'team';
    entity_id: string;
    permission_level: PermissionLevel;
    created_at: string;
    updated_at: string;
}

export class StoragePermissionService {
    /**
     * Get permission level for a specific entity.
     */
    async getPermission(entityType: 'user' | 'team', entityId: string): Promise<PermissionLevel> {
        const result = await queryOne<{ permission_level: number }>(
            'SELECT permission_level FROM storage_permissions WHERE entity_type = $1 AND entity_id = $2',
            [entityType, entityId]
        );
        return result?.permission_level ?? PermissionLevel.NONE;
    }

    /**
     * Set permission level for an entity.
     */
    async setPermission(entityType: 'user' | 'team', entityId: string, level: PermissionLevel): Promise<void> {
        await query(
            `INSERT INTO storage_permissions (entity_type, entity_id, permission_level, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (entity_type, entity_id)
             DO UPDATE SET permission_level = $3, updated_at = NOW()`,
            [entityType, entityId, level]
        );
    }

    /**
     * Resolve effective permission for a user.
     * Considers user's direct permission AND permissions of teams they lead.
     * Members do NOT inherit team permissions.
     */
    async resolveUserPermission(userId: string): Promise<PermissionLevel> {
        // 1. Get user's direct permission
        const userPerm = await this.getPermission('user', userId);

        // 2. Get permissions of teams where user is a LEADER
        const teamPerms = await query<{ permission_level: number }>(
            `SELECT sp.permission_level
             FROM storage_permissions sp
             JOIN user_teams ut ON sp.entity_id = ut.team_id::uuid
             WHERE sp.entity_type = 'team'
               AND ut.user_id = $1
               AND ut.role = 'leader'`,
            [userId]
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
    async getAllPermissions(): Promise<StoragePermission[]> {
        return query<StoragePermission>('SELECT * FROM storage_permissions');
    }
}

export const storagePermissionService = new StoragePermissionService();
