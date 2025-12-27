/**
 * Document permission controller: assigns per-bucket access to users/teams and resolves effective permissions.
 * Enforces leader-only grants for safety and returns consistent JSON error shapes.
 */
import { Request, Response } from 'express'
import { documentPermissionService, PermissionLevel } from '@/services/document-permission.service.js'
import { userService } from '@/services/user.service.js'
import { log } from '@/services/logger.service.js'
import { getClientIp } from '@/utils/ip.js'

export class DocumentPermissionController {
    /**
     * Get all permissions for a specific bucket.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<any>
     */
    async getAllPermissions(req: Request, res: Response): Promise<any> {
        try {
            const bucketId = req.query.bucketId as string;
            // Fetch permissions from service
            const perms = await documentPermissionService.getAllPermissions(bucketId);
            return res.json(perms);
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to fetch document permissions', { error });
            return res.status(500).json({ error: 'Failed to fetch permissions' });
        }
    }

    /**
     * Set permission level for a user or team on a bucket.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<any>
     */
    async setPermission(req: Request, res: Response): Promise<any> {
        const { entityType, entityId, bucketId, level } = req.body;

        // Validate input parameters
        if (!['user', 'team'].includes(entityType) || !entityId || !bucketId || level === undefined) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        try {
            // Security: Validate user role before granting permission
            // Admins have full access automatically, so permissions are only for leaders
            if (entityType === 'user') {
                const user = await userService.getUserById(entityId);
                if (!user) {
                    return res.status(404).json({ error: 'User not found' }); // User must exist
                }
                if (user.role !== 'leader') {
                    return res.status(403).json({ error: 'Leader role only' }); // Restrict to leaders
                }
            }

            // Capture actor for audit trail
            const actor = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
            // Apply permission change
            await documentPermissionService.setPermission(entityType, entityId, bucketId, Number(level), actor);
            return res.json({ success: true });
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to set document permission', { error });
            return res.status(500).json({ error: 'Failed to set permission' });
        }
    }

    /**
     * Resolve effective permission for the current user on a bucket.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<any>
     */
    async resolveUserPermission(req: Request, res: Response): Promise<any> {
        try {
            const userId = req.user?.id;
            const bucketId = req.query.bucketId as string;

            // Ensure user is authenticated
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Validate bucket ID
            if (!bucketId) {
                return res.status(400).json({ error: 'bucketId is required' });
            }

            // Admins always have FULL access, short-circuit check
            if (req.user?.role === 'admin') {
                return res.json({ level: PermissionLevel.FULL });
            }

            // Resolve permission level via service
            const level = await documentPermissionService.resolveUserPermission(userId, bucketId);
            return res.json({ level });
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to resolve permission', { error });
            return res.status(500).json({ error: 'Failed to resolve permission' });
        }
    }
}
