import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { documentPermissionService, PermissionLevel } from '../services/document-permission.service.js';
import { userService } from '../services/user.service.js';
import { log } from '../services/logger.service.js';
import { getClientIp } from '../utils/ip.js';

const router = Router();

// Require authentication for all routes
router.use(requireAuth);

/**
 * GET /api/document-permissions
 * Get all configured permissions
 * @requires admin role
 */
router.get('/', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const bucketId = req.query.bucketId as string;
        const perms = await documentPermissionService.getAllPermissions(bucketId);
        return res.json(perms);
    } catch (error) {
        log.error('Failed to fetch document permissions', { error });
        return res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

/**
 * POST /api/document-permissions
 * Set permission for an entity
 * Security: Only admins can grant document permissions, and only to leaders (admins have full access by default)
 * @requires admin role
 */
router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
    const { entityType, entityId, bucketId, level } = req.body;

    if (!['user', 'team'].includes(entityType) || !entityId || !bucketId || level === undefined) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        // Security: Validate user role before granting permission
        // Admins have full access automatically, so permissions are only for leaders
        if (entityType === 'user') {
            const user = await userService.getUserById(entityId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            if (user.role !== 'leader') {
                return res.status(403).json({ error: 'Leader role only' });
            }
        }

        const actor = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
        await documentPermissionService.setPermission(entityType, entityId, bucketId, Number(level), actor);
        return res.json({ success: true });
    } catch (error) {
        log.error('Failed to set document permission', { error });
        return res.status(500).json({ error: 'Failed to set permission' });
    }
});

/**
 * GET /api/document-permissions/resolve
 * Get effective permission for current user
 */
router.get('/resolve', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const bucketId = req.query.bucketId as string;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!bucketId) {
            return res.status(400).json({ error: 'bucketId is required' });
        }

        // Admins always have FULL access
        if (req.user?.role === 'admin') {
            return res.json({ level: PermissionLevel.FULL });
        }

        const level = await documentPermissionService.resolveUserPermission(userId, bucketId);
        return res.json({ level });
    } catch (error) {
        log.error('Failed to resolve permission', { error });
        return res.status(500).json({ error: 'Failed to resolve permission' });
    }
});

export default router;
