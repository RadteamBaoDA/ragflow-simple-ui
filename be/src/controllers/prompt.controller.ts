
import { Request, Response } from 'express';
import { promptService } from '@/services/prompt.service.js';

export class PromptController {
    static async getPrompts(req: Request, res: Response) {
        try {
            const { search, tag, source } = req.query;
            const filters: any = {};
            if (typeof search === 'string') filters.search = search;
            if (typeof tag === 'string') filters.tag = tag;
            if (typeof source === 'string') filters.source = source;

            const prompts = await promptService.getPrompts(filters);
            res.json(prompts);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch prompts' });
        }
    }

    static async createPrompt(req: Request, res: Response) {
        try {
            // userId inferred from auth middleware if available, else anonymous or from body
            // Assuming req.user exists from auth middleware
            // @ts-ignore
            const userId = req.user?.id || 'anonymous';
            const prompt = await promptService.createPrompt(userId, req.body);
            res.status(201).json(prompt);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to create prompt' });
        }
    }

    static async updatePrompt(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ error: 'ID is required' });
                return;
            }
            const prompt = await promptService.updatePrompt(id, req.body);
            res.json(prompt);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to update prompt' });
        }
    }

    static async deletePrompt(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ error: 'ID is required' });
                return;
            }
            await promptService.deletePrompt(id);
            res.status(204).send();
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to delete prompt' });
        }
    }

    static async addInteraction(req: Request, res: Response) {
        try {
            // @ts-ignore
            const userId = req.user?.id || 'anonymous';
            const interaction = await promptService.addInteraction(userId, req.body);
            res.status(201).json(interaction);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to add interaction' });
        }
    }

    static async getTags(req: Request, res: Response) {
        try {
            const tags = await promptService.getAllTags();
            res.json(tags);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch tags' });
        }
    }

    /**
     * Get feedback counts (like/dislike) for a specific prompt.
     */
    static async getFeedbackCounts(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ error: 'Prompt ID is required' });
                return;
            }
            const counts = await promptService.getFeedbackCounts(id);
            res.json(counts);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch feedback counts' });
        }
    }

    /**
     * Get all interactions (feedback) for a specific prompt.
     * Supports date filtering via query params: startDate, endDate
     */
    static async getInteractions(req: Request, res: Response) {
        try {
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
            res.json(interactions);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch interactions' });
        }
    }

    /**
     * Get all unique sources used in prompts.
     */
    static async getSources(req: Request, res: Response) {
        try {
            const sources = await promptService.getAllSources();
            res.json(sources);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch sources' });
        }
    }

    /**
     * Get chat source names from knowledge_base_sources for tag dropdown.
     */
    static async getChatSources(req: Request, res: Response) {
        try {
            const sources = await promptService.getChatSourceNames();
            res.json(sources);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch chat sources' });
        }
    }
}
