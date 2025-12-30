/**
 * Knowledge base controller: CRUD for RAGFlow source registry and iframe configuration exposure.
 * Passes user context to service layer for audit/authorization decisions.
 */
import { Request, Response } from 'express'
import { knowledgeBaseService } from '@/services/knowledge-base.service.js'
import { log } from '@/services/logger.service.js'
import { getClientIp } from '@/utils/ip.js'

export class KnowledgeBaseController {
    /**
     * Get all knowledge base sources.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async getSources(req: Request, res: Response): Promise<void> {
        try {
            // Fetch sources from service
            const sources = await knowledgeBaseService.getSources();
            res.json(sources);
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to fetch knowledge base sources', { error: String(error) });
            res.status(500).json({ error: 'Failed to fetch knowledge base sources' });
        }
    }

    /**
     * Create a new knowledge base source.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async createSource(req: Request, res: Response): Promise<void> {
        try {
            // Capture user context for audit
            const user = req.user ? { id: req.user.id, email: req.user.email, role: req.user.role, ip: getClientIp(req) } : undefined;
            // Create source via service
            const source = await knowledgeBaseService.createSource(req.body, user);
            res.status(201).json(source);
        } catch (error: any) {
            // Log error
            log.error('Failed to create knowledge base source', { error: String(error) });

            // Return specific error message if available, otherwise generic
            const status = error.message?.includes('already exists') ? 409 : 500;
            res.status(status).json({ error: error.message || 'Failed to create knowledge base source' });
        }
    }

    /**
     * Update an existing knowledge base source.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async updateSource(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        // Validate ID presence
        if (!id) {
            res.status(400).json({ error: 'Source ID is required' });
            return;
        }
        try {
            // Capture user context for audit
            const user = req.user ? { id: req.user.id, email: req.user.email, role: req.user.role, ip: getClientIp(req) } : undefined;
            // Update source via service
            const source = await knowledgeBaseService.updateSource(id, req.body, user);

            // Handle not found case
            if (!source) {
                res.status(404).json({ error: 'Source not found' });
                return;
            }
            res.json(source);
        } catch (error: any) {
            // Log error
            log.error('Failed to update knowledge base source', { error: String(error) });

            // Return specific error message if available
            const status = error.message?.includes('already exists') ? 409 : 500;
            res.status(status).json({ error: error.message || 'Failed to update knowledge base source' });
        }
    }

    /**
     * Delete a knowledge base source.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async deleteSource(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        // Validate ID presence
        if (!id) {
            res.status(400).json({ error: 'Source ID is required' });
            return;
        }
        try {
            // Capture user context for audit
            const user = req.user ? { id: req.user.id, email: req.user.email, role: req.user.role, ip: getClientIp(req) } : undefined;
            // Delete source via service
            await knowledgeBaseService.deleteSource(id, user);
            res.status(204).send();
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to delete knowledge base source', { error: String(error) });
            res.status(500).json({ error: 'Failed to delete knowledge base source' });
        }
    }

    /**
     * Get knowledge base configuration.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async getConfig(req: Request, res: Response): Promise<void> {
        try {
            // Capture user context for audit (even for read if needed)
            const user = req.user ? { id: req.user.id, email: req.user.email, role: req.user.role, ip: getClientIp(req) } : undefined;
            // Fetch config from service
            const config = await knowledgeBaseService.getConfig(user);
            res.json(config);
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to fetch knowledge base config', { error: String(error) });
            res.status(500).json({ error: 'Failed to fetch knowledge base config' });
        }
    }

    /**
     * Update knowledge base configuration.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async updateConfig(req: Request, res: Response): Promise<void> {
        try {
            // Capture user context for audit
            const user = req.user ? { id: req.user.id, email: req.user.email, role: req.user.role, ip: getClientIp(req) } : undefined;
            // Update config via service
            await knowledgeBaseService.updateConfig(req.body, user);
            res.status(204).send();
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to update knowledge base config', { error: String(error) });
            res.status(500).json({ error: 'Failed to update knowledge base config' });
        }
    }
}
