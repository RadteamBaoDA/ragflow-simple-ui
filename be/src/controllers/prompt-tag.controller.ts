
/**
 * PromptTagController: Handles HTTP requests for prompt tag operations.
 * Delegates business logic to PromptTagService.
 */
import { Request, Response } from 'express';
import { promptTagService } from '@/services/prompt-tag.service.js';

/**
 * Controller class for prompt tag API endpoints.
 */
export class PromptTagController {
    /**
     * Get newest tags or search tags by query.
     * GET /api/prompt-tags
     * Query params: limit (optional, default 5)
     */
    static async getTags(req: Request, res: Response) {
        try {
            const limit = parseInt(req.query.limit as string) || 5;
            const tags = await promptTagService.getNewestTags(limit);
            res.json(tags);
        } catch (error) {
            console.error('Error fetching tags:', error);
            res.status(500).json({ error: 'Failed to fetch tags' });
        }
    }

    /**
     * Search tags by name.
     * GET /api/prompt-tags/search
     * Query params: q (search query), limit (optional, default 10)
     */
    static async searchTags(req: Request, res: Response) {
        try {
            const query = (req.query.q as string) || '';
            const limit = parseInt(req.query.limit as string) || 10;
            const tags = await promptTagService.searchTags(query, limit);
            res.json(tags);
        } catch (error) {
            console.error('Error searching tags:', error);
            res.status(500).json({ error: 'Failed to search tags' });
        }
    }

    /**
     * Create a new tag.
     * POST /api/prompt-tags
     * Body: { name: string, color?: string }
     */
    static async createTag(req: Request, res: Response) {
        try {
            const { name, color } = req.body;

            if (!name || typeof name !== 'string' || name.trim() === '') {
                res.status(400).json({ error: 'Tag name is required' });
                return;
            }

            // @ts-ignore - userId from auth middleware
            const userId = req.user?.id || undefined;

            const tag = await promptTagService.createTag(name.trim(), color, userId);
            res.status(201).json(tag);
        } catch (error) {
            console.error('Error creating tag:', error);
            res.status(500).json({ error: 'Failed to create tag' });
        }
    }

    /**
     * Get tags by IDs.
     * POST /api/prompt-tags/by-ids
     * Body: { ids: string[] }
     */
    static async getTagsByIds(req: Request, res: Response) {
        try {
            const { ids } = req.body;

            if (!ids || !Array.isArray(ids)) {
                res.status(400).json({ error: 'Tag IDs array is required' });
                return;
            }

            const tags = await promptTagService.getTagsByIds(ids);
            res.json(tags);
        } catch (error) {
            console.error('Error fetching tags by IDs:', error);
            res.status(500).json({ error: 'Failed to fetch tags' });
        }
    }
}
