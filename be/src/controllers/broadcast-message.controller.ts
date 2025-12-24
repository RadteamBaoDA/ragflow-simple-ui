
import { Request, Response } from 'express';
import { broadcastMessageService } from '@/services/broadcast-message.service.js';
import { log } from '@/services/logger.service.js';
import { getClientIp } from '@/utils/ip.js';

export class BroadcastMessageController {
    async getActive(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const messages = await broadcastMessageService.getActiveMessages(userId);
            res.json(messages);
        } catch (error) {
            log.error('Failed to fetch active broadcast messages', { error: String(error) });
            res.status(500).json({ error: 'Failed to fetch active broadcast messages' });
        }
    }

    async getAll(req: Request, res: Response): Promise<void> {
        try {
            const messages = await broadcastMessageService.getAllMessages();
            res.json(messages);
        } catch (error) {
            log.error('Failed to fetch all broadcast messages', { error: String(error) });
            res.status(500).json({ error: 'Failed to fetch all broadcast messages' });
        }
    }

    async create(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
            const message = await broadcastMessageService.createMessage(req.body, user);
            res.status(201).json(message);
        } catch (error) {
            log.error('Failed to create broadcast message', { error: String(error) });
            res.status(500).json({ error: 'Failed to create broadcast message' });
        }
    }

    async update(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ error: 'Message ID is required' });
            return;
        }
        try {
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
            const message = await broadcastMessageService.updateMessage(id, req.body, user);
            if (!message) {
                res.status(404).json({ error: 'Broadcast message not found' });
                return;
            }
            res.json(message);
        } catch (error) {
            log.error('Failed to update broadcast message', { error: String(error) });
            res.status(500).json({ error: 'Failed to update broadcast message' });
        }
    }

    async delete(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ error: 'Message ID is required' });
            return;
        }
        try {
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
            await broadcastMessageService.deleteMessage(id, user);
            res.status(204).send();
        } catch (error) {
            log.error('Failed to delete broadcast message', { error: String(error) });
            res.status(500).json({ error: 'Failed to delete broadcast message' });
        }
    }

    async dismiss(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!id) {
            res.status(400).json({ error: 'Message ID is required' });
            return;
        }
        if (!userId) {
            res.status(401).json({ error: 'User must be authenticated' });
            return;
        }

        try {
            await broadcastMessageService.dismissMessage(id, userId);
            res.status(204).send();
        } catch (error) {
            log.error('Failed to dismiss broadcast message', { error: String(error) });
            res.status(500).json({ error: 'Failed to dismiss broadcast message' });
        }
    }
}
