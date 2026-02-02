
import { Request, Response } from 'express';
import { promptService } from '@/services/prompt.service.js';
import { promptPermissionService } from '@/services/prompt-permission.service.js';
import { PermissionLevel } from '@/models/types.js';

export class PromptController {
    static async getPrompts(req: Request, res: Response) {
        try {
            // Check VIEW permission
            const user = (req as any).user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Unauthorized: User ID missing' });
            }
            const level = await promptPermissionService.resolveUserPermission(user.id);
            if (level < PermissionLevel.VIEW) {
                return res.status(403).json({ error: 'Permission denied: VIEW required' });
            }

            const { search, tag, tags, source, limit, offset } = req.query;
            const filters: any = {};
            if (typeof search === 'string') filters.search = search;
            if (typeof tag === 'string') filters.tag = tag;
            if (typeof tags === 'string') filters.tags = tags.split(',').map(t => t.trim());
            if (typeof source === 'string') filters.source = source;
            if (typeof limit === 'string') filters.limit = parseInt(limit, 10);
            if (typeof offset === 'string') filters.offset = parseInt(offset, 10);

            const result = await promptService.getPrompts(filters);
            return res.json(result);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to fetch prompts' });
        }
    }

    static async createPrompt(req: Request, res: Response) {
        try {
            // Check UPLOAD (Add/Edit) permission
            const user = (req as any).user;
            const level = await promptPermissionService.resolveUserPermission(user.id);
            if (level < PermissionLevel.UPLOAD) {
                return res.status(403).json({ error: 'Permission denied: ADD/EDIT required' });
            }

            const userId = user.id || 'anonymous';
            // Build user context for audit logging
            const userContext = {
                id: user.id,
                email: user.email,
                ip: req.ip || req.socket?.remoteAddress
            };
            const prompt = await promptService.createPrompt(userId, req.body, userContext);
            return res.status(201).json(prompt);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to create prompt' });
        }
    }

    static async updatePrompt(req: Request, res: Response) {
        try {
            // Check UPLOAD (Add/Edit) permission
            const user = (req as any).user;
            const level = await promptPermissionService.resolveUserPermission(user.id);
            if (level < PermissionLevel.UPLOAD) {
                return res.status(403).json({ error: 'Permission denied: ADD/EDIT required' });
            }

            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'ID is required' });
            }
            // Build user context for audit logging
            const userContext = {
                id: user.id,
                email: user.email,
                ip: req.ip || req.socket?.remoteAddress
            };
            const prompt = await promptService.updatePrompt(id, req.body, userContext);
            return res.json(prompt);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to update prompt' });
        }
    }

    static async deletePrompt(req: Request, res: Response) {
        try {
            // Check FULL (All/Delete) permission
            const user = (req as any).user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Unauthorized: User ID missing' });
            }
            const level = await promptPermissionService.resolveUserPermission(user.id);
            if (level < PermissionLevel.FULL) {
                return res.status(403).json({ error: 'Permission denied: DELETE required' });
            }

            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'ID is required' });
            }
            // Build user context for audit logging
            const userContext = {
                id: user.id,
                email: user.email,
                ip: req.ip || req.socket?.remoteAddress
            };
            await promptService.deletePrompt(id, userContext);
            return res.status(204).send();
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to delete prompt' });
        }
    }

    static async addInteraction(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Unauthorized: User ID missing' });
            }
            const userId = user.id;
            const interaction = await promptService.addInteraction(userId, req.body);
            return res.status(201).json(interaction);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to add interaction' });
        }
    }

    static async getTags(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Unauthorized: User ID missing' });
            }
            const level = await promptPermissionService.resolveUserPermission(user.id);
            if (level < PermissionLevel.VIEW) {
                return res.status(403).json({ error: 'Permission denied: VIEW required' });
            }

            const tags = await promptService.getAllTags();
            return res.json(tags);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to fetch tags' });
        }
    }

    /**
     * Get feedback counts (like/dislike) for a specific prompt.
     */
    static async getFeedbackCounts(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Unauthorized: User ID missing' });
            }
            const level = await promptPermissionService.resolveUserPermission(user.id);
            if (level < PermissionLevel.VIEW) {
                return res.status(403).json({ error: 'Permission denied: VIEW required' });
            }

            const { id } = req.params;
            if (!id) {
                res.status(400).json({ error: 'Prompt ID is required' });
                return;
            }
            const counts = await promptService.getFeedbackCounts(id);
            return res.json(counts);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to fetch feedback counts' });
        }
    }

    /**
     * Get all interactions (feedback) for a specific prompt.
     * Supports date filtering via query params: startDate, endDate
     */
    static async getInteractions(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Unauthorized: User ID missing' });
            }
            const level = await promptPermissionService.resolveUserPermission(user.id);
            if (level < PermissionLevel.VIEW) {
                return res.status(403).json({ error: 'Permission denied: VIEW required' });
            }

            const { id } = req.params;
            const { startDate, endDate } = req.query;
            if (!id) {
                res.status(400).json({ error: 'Prompt ID is required' });
                return;
            }
            const interactions = await promptService.getInteractionsForPrompt(
                id,
                typeof startDate === 'string' ? startDate : undefined,
                typeof endDate === 'string' ? endDate : undefined
            );
            return res.json(interactions);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to fetch interactions' });
        }
    }

    /**
     * Get all unique sources used in prompts.
     */
    static async getSources(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Unauthorized: User ID missing' });
            }
            const level = await promptPermissionService.resolveUserPermission(user.id);
            if (level < PermissionLevel.VIEW) {
                return res.status(403).json({ error: 'Permission denied: VIEW required' });
            }

            const sources = await promptService.getAllSources();
            return res.json(sources);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to fetch sources' });
        }
    }

    /**
     * Get chat source names from knowledge_base_sources for tag dropdown.
     */
    static async getChatSources(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Unauthorized: User ID missing' });
            }
            const level = await promptPermissionService.resolveUserPermission(user.id);
            if (level < PermissionLevel.VIEW) {
                return res.status(403).json({ error: 'Permission denied: VIEW required' });
            }

            const sources = await promptService.getChatSourceNames();
            return res.json(sources);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to fetch chat sources' });
        }
    }

    /**
     * Bulk create prompts from CSV import.
     * Requires UPLOAD permission.
     */
    static async bulkCreate(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Unauthorized: User ID missing' });
            }
            const level = await promptPermissionService.resolveUserPermission(user.id);
            if (level < PermissionLevel.UPLOAD) {
                return res.status(403).json({ error: 'Permission denied: ADD/EDIT required' });
            }

            const prompts = req.body;
            if (!Array.isArray(prompts) || prompts.length === 0) {
                return res.status(400).json({ error: 'Request body must be a non-empty array of prompts' });
            }

            // Validate each prompt has required 'prompt' field
            for (let i = 0; i < prompts.length; i++) {
                if (!prompts[i].prompt || typeof prompts[i].prompt !== 'string') {
                    return res.status(400).json({ error: `Item at index ${i} is missing required 'prompt' field` });
                }
            }

            const userContext = {
                id: user.id,
                email: user.email,
                ip: req.ip || req.socket?.remoteAddress
            };
            const result = await promptService.bulkCreate(user.id, prompts, userContext);
            return res.status(201).json(result);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to bulk create prompts' });
        }
    }
}
