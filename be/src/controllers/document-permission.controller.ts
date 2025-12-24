
import { Request, Response } from 'express';
import { documentPermissionService } from '../services/document-permission.service.js';
import { log } from '../services/logger.service.js';
import { getClientIp } from '../utils/ip.js';

export class DocumentPermissionController {
  async getPermissions(req: Request, res: Response): Promise<void> {
    const { bucketId } = req.params;
    if (!bucketId) {
        res.status(400).json({ error: 'Bucket ID is required' });
        return;
    }
    try {
        const permissions = await documentPermissionService.getPermissions(bucketId);
        res.json(permissions);
    } catch (error) {
        log.error('Failed to fetch document permissions', { error: String(error) });
        res.status(500).json({ error: 'Failed to fetch document permissions' });
    }
  }

  async setPermissions(req: Request, res: Response): Promise<void> {
    const { bucketId } = req.params;
    if (!bucketId) {
        res.status(400).json({ error: 'Bucket ID is required' });
        return;
    }
    try {
        const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
        // Expecting body to be an array of permissions or a single permission object?
        // Checking route/service usage usually helps. Assuming body is the payload.
        await documentPermissionService.setPermissions(bucketId, req.body, user);
        res.json({ message: 'Permissions updated successfully' });
    } catch (error) {
        log.error('Failed to update document permissions', { error: String(error) });
        res.status(500).json({ error: 'Failed to update document permissions' });
    }
  }
}
