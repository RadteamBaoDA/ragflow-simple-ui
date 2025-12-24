/**
 * @fileoverview API routes for broadcast messages.
 */

import { Router, Request, Response } from 'express';
import { broadcastMessageService } from '../services/broadcast-message.service.js';
import { log } from '../services/logger.service.js';
import { requirePermission } from '../middleware/auth.middleware.js';
import { getClientIp } from '../utils/ip.js';

const router = Router();

/**
 * GET /api/broadcast-messages/active
 * Fetch active messages, optionally filtered by user dismissal.
 */
router.get('/active', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const messages = await broadcastMessageService.getActiveMessages(userId);
        res.json(messages);
    } catch (error) {
        log.error('Failed to fetch active broadcast messages', { error: String(error) });
        res.status(500).json({ error: 'Failed to fetch broadcast messages' });
    }
});

/**
 * POST /api/broadcast-messages/:id/dismiss
 * Record dismissal of a broadcast message for the current user.
 */
router.post('/:id/dismiss', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { id: broadcastId } = req.params;

        if (!userId) {
            // If not logged in, we silently succeed (frontend will fallback to localStorage)
            return res.json({ success: true, localOnly: true });
        }

        if (!broadcastId) {
            return res.status(400).json({ error: 'ID is required' });
        }

        await broadcastMessageService.dismissMessage(userId, broadcastId, req.user?.email, getClientIp(req));
        return res.json({ success: true });
    } catch (error) {
        log.error('Failed to dismiss broadcast message', { id: req.params.id, error: String(error) });
        return res.status(500).json({ error: 'Failed to dismiss broadcast message' });
    }
});

/**
 * Admin routes (prefixed with /api/broadcast-messages/admin or handled via permission check)
 */

/**
 * GET /api/broadcast-messages
 * List all messages (requires manage_system permission).
 */
router.get('/', requirePermission('manage_system'), async (req: Request, res: Response) => {
    try {
        const messages = await broadcastMessageService.getAllMessages();
        res.json(messages);
    } catch (error) {
        log.error('Failed to fetch all broadcast messages', { error: String(error) });
        res.status(500).json({ error: 'Failed to fetch broadcast messages' });
    }
});

/**
 * POST /api/broadcast-messages
 * Create a message.
 */
router.post('/', requirePermission('manage_system'), async (req: Request, res: Response) => {
    try {
        const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
        const message = await broadcastMessageService.createMessage(req.body, user);
        res.status(201).json(message);
    } catch (error) {
        log.error('Failed to create broadcast message', { error: String(error) });
        res.status(500).json({ error: 'Failed to create broadcast message' });
    }
});

/**
 * PUT /api/broadcast-messages/:id
 * Update a message.
 */
router.put('/:id', requirePermission('manage_system'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'ID is required' });
        }
        const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
        const message = await broadcastMessageService.updateMessage(id, req.body, user);
        if (!message) {
            return res.status(404).json({ error: 'Broadcast message not found' });
        }
        return res.json(message);
    } catch (error) {
        log.error('Failed to update broadcast message', { id: req.params.id, error: String(error) });
        return res.status(500).json({ error: 'Failed to update broadcast message' });
    }
});

/**
 * DELETE /api/broadcast-messages/:id
 * Delete a message.
 */
router.delete('/:id', requirePermission('manage_system'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'ID is required' });
        }
        const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
        const deleted = await broadcastMessageService.deleteMessage(id, user);
        if (!deleted) {
            return res.status(404).json({ error: 'Broadcast message not found' });
        }
        return res.json({ success: true });
    } catch (error) {
        log.error('Failed to delete broadcast message', { id: req.params.id, error: String(error) });
        return res.status(500).json({ error: 'Failed to delete broadcast message' });
    }
});

export default router;
