
/**
 * PromptTagService: Business logic for prompt tag management.
 * Delegates all database operations to Model classes using Knex ORM.
 * Implements Singleton pattern for shared instance.
 */
import { ModelFactory } from '@/models/factory.js';
import { PromptTag } from '@/models/types.js';

/**
 * PromptTagService class handles all tag-related business logic.
 * Uses ModelFactory for database operations following the repository pattern.
 */
export class PromptTagService {
    private static instance: PromptTagService;

    /**
     * Get the shared singleton instance of PromptTagService.
     * @returns PromptTagService singleton instance
     */
    static getSharedInstance(): PromptTagService {
        if (!this.instance) {
            this.instance = new PromptTagService();
        }
        return this.instance;
    }

    /**
     * Get the newest tags ordered by creation date.
     * @param limit - Maximum number of tags to return (default 5)
     * @returns Array of newest tags
     */
    async getNewestTags(limit: number = 5): Promise<PromptTag[]> {
        return ModelFactory.promptTag.getNewestTags(limit);
    }

    /**
     * Search tags by name.
     * @param query - Search query string
     * @param limit - Maximum number of results (default 10)
     * @returns Array of matching tags
     */
    async searchTags(query: string, limit: number = 10): Promise<PromptTag[]> {
        if (!query || query.trim() === '') {
            return this.getNewestTags(limit);
        }
        return ModelFactory.promptTag.searchByName(query, limit);
    }

    /**
     * Create a new tag with specified name and color.
     * @param name - Tag name
     * @param color - Color in hex format (optional, random if not provided)
     * @param userId - User ID for audit columns
     * @returns Created tag
     */
    async createTag(name: string, color?: string, userId?: string): Promise<PromptTag> {
        // Generate random color if not provided
        const tagColor = color || this.generateRandomColor();
        return ModelFactory.promptTag.findOrCreate(name, tagColor, userId);
    }

    /**
     * Find or create multiple tags by name.
     * Creates any tags that don't exist with random colors.
     * @param names - Array of tag names
     * @param userId - User ID for audit columns
     * @returns Array of tags (existing + newly created)
     */
    async getOrCreateTags(names: string[], userId?: string): Promise<PromptTag[]> {
        if (!names || names.length === 0) return [];
        return ModelFactory.promptTag.findOrCreateMany(names, userId);
    }

    /**
     * Get tag by ID.
     * @param id - Tag UUID
     * @returns Tag if found, undefined otherwise
     */
    async getTagById(id: string): Promise<PromptTag | undefined> {
        return ModelFactory.promptTag.findById(id);
    }

    /**
     * Get multiple tags by IDs.
     * @param ids - Array of tag UUIDs
     * @returns Array of tags
     */
    async getTagsByIds(ids: string[]): Promise<PromptTag[]> {
        return ModelFactory.promptTag.findByIds(ids);
    }

    /**
     * Generate a random hex color.
     * @returns Random hex color string (e.g., #FF5733)
     */
    private generateRandomColor(): string {
        return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    }
}

export const promptTagService = PromptTagService.getSharedInstance();
