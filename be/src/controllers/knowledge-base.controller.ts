
import { Request, Response } from 'express';
import { knowledgeBaseService } from '@/services/knowledge-base.service.js';
import { log } from '@/services/logger.service.js';
import { getClientIp } from '@/utils/ip.js';

export class KnowledgeBaseController {
    async getSources(req: Request, res: Response): Promise<void> {
        try {
            const sources = await knowledgeBaseService.getSources();
            res.json(sources);
        } catch (error) {
            log.error('Failed to fetch knowledge base sources', { error: String(error) });
            res.status(500).json({ error: 'Failed to fetch knowledge base sources' });
        }
    }

    async createSource(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
            const source = await knowledgeBaseService.createSource(req.body, user);
            res.status(201).json(source);
        } catch (error) {
            log.error('Failed to create knowledge base source', { error: String(error) });
            res.status(500).json({ error: 'Failed to create knowledge base source' });
        }
    }

    async updateSource(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ error: 'Source ID is required' });
            return;
        }
        try {
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
            const source = await knowledgeBaseService.updateSource(id, req.body, user);
            if (!source) {
                res.status(404).json({ error: 'Source not found' });
                return;
            }
            res.json(source);
        } catch (error) {
            log.error('Failed to update knowledge base source', { error: String(error) });
            res.status(500).json({ error: 'Failed to update knowledge base source' });
        }
    }

    async deleteSource(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ error: 'Source ID is required' });
            return;
        }
        try {
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
            await knowledgeBaseService.deleteSource(id, user);
            res.status(204).send();
        } catch (error) {
            log.error('Failed to delete knowledge base source', { error: String(error) });
            res.status(500).json({ error: 'Failed to delete knowledge base source' });
        }
    }

    async getConfig(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
            const config = await knowledgeBaseService.getConfig(user);
            res.json(config);
        } catch (error) {
            log.error('Failed to fetch knowledge base config', { error: String(error) });
            res.status(500).json({ error: 'Failed to fetch knowledge base config' });
        }
    }
}
