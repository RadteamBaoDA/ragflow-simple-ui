
/**
 * PromptService: Business logic for prompt management.
 * Delegates all database operations to Model classes using Knex ORM.
 * Implements Singleton pattern for shared instance.
 */
import { ModelFactory } from '@/models/factory.js';
import { Prompt, PromptInteraction } from '@/models/types.js';

/**
 * PromptService class handles all prompt-related business logic.
 * Uses ModelFactory for database operations following the repository pattern.
 */
export class PromptService {
    private static instance: PromptService;

    /**
     * Get the shared singleton instance of PromptService.
     * @returns PromptService singleton instance
     */
    static getSharedInstance(): PromptService {
        if (!this.instance) {
            this.instance = new PromptService();
        }
        return this.instance;
    }

    /**
     * Create a new prompt.
     * @param userId - ID of the user creating the prompt
     * @param data - Partial prompt data
     * @returns Created prompt with normalized tags
     */
    async createPrompt(userId: string, data: Partial<Prompt>): Promise<Prompt> {
        const promptData = {
            ...data,
            tags: JSON.stringify(data.tags || []),
            source: data.source || 'chat',
            is_active: true
        };
        // Create using model factory
        const prompt = await ModelFactory.prompt.create(promptData as any);
        return this.normalizePrompt(prompt);
    }

    /**
     * Get all prompts with feedback counts and optional filtering and pagination.
     * @param filters - Optional filters for search, tag, source, limit, and offset
     * @returns Paginated response with prompts array and total count
     */
    async getPrompts(filters: { search?: string; tag?: string; source?: string; limit?: number; offset?: number } = {}): Promise<{ data: Prompt[]; total: number }> {
        const result = await ModelFactory.prompt.findActiveWithFeedbackCounts(filters);
        return {
            data: result.data.map((r: Prompt) => this.normalizePrompt(r)),
            total: result.total
        };
    }

    /**
     * Get a single prompt by ID.
     * @param id - Prompt ID
     * @returns Prompt with normalized tags
     * @throws Error if prompt not found
     */
    async getPromptById(id: string): Promise<Prompt> {
        const prompt = await ModelFactory.prompt.findById(id);
        if (!prompt) throw new Error('Prompt not found');
        return this.normalizePrompt(prompt);
    }

    /**
     * Update an existing prompt.
     * @param id - Prompt ID to update
     * @param data - Partial prompt data to update
     * @returns Updated prompt with normalized tags
     * @throws Error if prompt not found
     */
    async updatePrompt(id: string, data: Partial<Prompt>): Promise<Prompt> {
        const updateData = { ...data };
        // Stringify tags if provided
        if (updateData.tags) {
            // @ts-ignore - tags need to be stringified for JSON storage
            updateData.tags = JSON.stringify(updateData.tags);
        }
        const prompt = await ModelFactory.prompt.update(id, updateData);
        if (!prompt) throw new Error('Prompt not found');
        return this.normalizePrompt(prompt);
    }

    /**
     * Delete a prompt (soft delete by setting is_active = false).
     * @param id - Prompt ID to delete
     */
    async deletePrompt(id: string): Promise<void> {
        await ModelFactory.prompt.delete(id);
    }

    /**
     * Add an interaction (like, dislike, comment) to a prompt.
     * Saves the current prompt text as a snapshot for history tracking.
     * @param userId - ID of the user adding the interaction
     * @param data - Interaction data including prompt_id and type
     * @returns Created interaction
     */
    async addInteraction(
        userId: string,
        data: { prompt_id: string; interaction_type: 'like' | 'dislike' | 'comment'; comment?: string }
    ): Promise<PromptInteraction> {
        // Fetch the current prompt text for history snapshot
        const prompt = await ModelFactory.prompt.findById(data.prompt_id);
        const promptSnapshot = prompt?.prompt || null;

        const interactionData = {
            ...data,
            user_id: userId,
            prompt_snapshot: promptSnapshot
        };
        return ModelFactory.promptInteraction.create(interactionData);
    }

    /**
     * Get feedback counts (likes/dislikes) for a prompt.
     * @param promptId - ID of the prompt
     * @returns Object with like_count and dislike_count
     */
    async getFeedbackCounts(promptId: string): Promise<{ like_count: number; dislike_count: number }> {
        return ModelFactory.promptInteraction.getFeedbackCounts(promptId);
    }

    /**
     * Get all interactions for a prompt with user email, optionally filtered by date.
     * @param promptId - ID of the prompt
     * @param startDate - Optional start date filter (ISO string)
     * @param endDate - Optional end date filter (ISO string)
     * @returns Array of interactions with user email
     */
    async getInteractionsForPrompt(
        promptId: string,
        startDate?: string,
        endDate?: string
    ): Promise<(PromptInteraction & { user_email?: string })[]> {
        return ModelFactory.promptInteraction.getInteractionsWithUser(promptId, startDate, endDate);
    }

    /**
     * Get all unique tags from active prompts.
     * @returns Array of unique tag strings
     */
    async getAllTags(): Promise<string[]> {
        return ModelFactory.prompt.getAllTags();
    }

    /**
     * Get all unique sources from active prompts.
     * @returns Array of unique source strings
     */
    async getAllSources(): Promise<string[]> {
        return ModelFactory.prompt.getAllSources();
    }

    /**
     * Get chat source names from knowledge_base_sources.
     * Used to populate the tags dropdown in the prompt form.
     * @returns Array of chat source names
     */
    async getChatSourceNames(): Promise<string[]> {
        return ModelFactory.knowledgeBaseSource.getChatSourceNames();
    }

    /**
     * Normalize prompt by parsing stringified tags JSON.
     * @param prompt - Prompt with potentially stringified tags
     * @returns Prompt with parsed tags array
     * @private
     */
    private normalizePrompt(prompt: Prompt): Prompt {
        if (typeof prompt.tags === 'string') {
            try {
                prompt.tags = JSON.parse(prompt.tags);
            } catch (e) {
                prompt.tags = [];
            }
        }
        return prompt;
    }
}

export const promptService = PromptService.getSharedInstance();
