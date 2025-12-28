
import { Request, Response } from 'express';
import { promptPermissionService } from '@/services/prompt-permission.service.js';

export class PromptPermissionController {
    /**
     * Get all prompt permissions (Admin only).
     */
    async getPermissions(req: Request, res: Response) {
        try {
            const permissions = await promptPermissionService.getAllPermissions();
            return res.json(permissions);
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch permissions' });
        }
    }

    /**
     * Set permission for an entity (Admin only).
     */
    async setPermission(req: Request, res: Response) {
        const { entityType, entityId, level } = req.body;
        const user = (req as any).user;

        if (!entityType || !entityId || level === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            await promptPermissionService.setPermission(entityType, entityId, level, {
                id: user.id,
                email: user.email,
                ip: req.ip as string | undefined
            });
            return res.json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to set permission' });
        }
    }

    /**
     * Get calling user's effective permission.
     */
    async getMyPermission(req: Request, res: Response) {
        const user = (req as any).user;
        try {
            const level = await promptPermissionService.resolveUserPermission(user.id);
            return res.json({ level });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to resolve permission' });
        }
    }
}

export const promptPermissionController = new PromptPermissionController();
