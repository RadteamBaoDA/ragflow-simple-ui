import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import { storagePermissionService, PermissionLevel } from '../services/storage-permission.service.js';
import { log } from '../services/logger.service.js';

const router = Router();

// Require admin permission to manage permissions
router.use(requireAuth);
router.use(requirePermission('manage_system')); // Or manage_users? Let's use manage_system for now as it influences storage.

/**
 * GET /api/storage-permissions
 * Get all configured permissions
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const perms = await storagePermissionService.getAllPermissions();
        res.json(perms);
    } catch (error) {
        log.error('Failed to fetch storage permissions', { error });
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

/**
 * POST /api/storage-permissions
 * Set permission for an entity
 */
router.post('/', async (req: Request, res: Response) => {
    const { entityType, entityId, level } = req.body;

    if (!['user', 'team'].includes(entityType) || !entityId || level === undefined) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        await storagePermissionService.setPermission(entityType, entityId, Number(level));
        return res.json({ success: true });
    } catch (error) {
        log.error('Failed to set storage permission', { error });
        return res.status(500).json({ error: 'Failed to set permission' });
    }
});

/**
 * GET /api/storage-permissions/resolve
 * Get effective permission for current user
 */
router.get('/resolve', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Admins always have FULL access? Maybe. 
        // For now, let's treat admin as normal user subject to permissions, OR give them implicit full access.
        // Usually admins have full access.
        if (req.user?.role === 'admin') {
            return res.json({ level: PermissionLevel.FULL });
        }

        const level = await storagePermissionService.resolveUserPermission(userId);
        return res.json({ level });
    } catch (error) {
        log.error('Failed to resolve permission', { error });
        return res.status(500).json({ error: 'Failed to resolve permission' });
    }
});

export default router;
