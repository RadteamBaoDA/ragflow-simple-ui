
/**
 * PromptTag model: manages reusable tags with colors.
 * Provides custom query methods for tag-specific operations.
 * Uses Knex ORM for all database operations.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { PromptTag } from '@/models/types.js'

/**
 * PromptTagModel extends BaseModel with tag-specific query methods.
 * Uses Knex ORM for all database operations - no raw SQL in services.
 */
export class PromptTagModel extends BaseModel<PromptTag> {
    protected tableName = 'prompt_tags'
    protected knex = db

    /**
     * Get the newest tags ordered by created_at descending.
     * @param limit - Maximum number of tags to return (default 5)
     * @returns Array of newest tags
     */
    async getNewestTags(limit: number = 5): Promise<PromptTag[]> {
        return this.knex(this.tableName)
            .orderBy('created_at', 'desc')
            .limit(limit);
    }

    /**
     * Search tags by name using case-insensitive LIKE.
     * @param query - Search query string
     * @param limit - Maximum number of results (default 10)
     * @returns Array of matching tags
     */
    async searchByName(query: string, limit: number = 10): Promise<PromptTag[]> {
        return this.knex(this.tableName)
            .whereRaw('LOWER(name) LIKE ?', [`%${query.toLowerCase()}%`])
            .orderBy('name', 'asc')
            .limit(limit);
    }

    /**
     * Find a tag by exact name (case-insensitive).
     * @param name - Tag name to search for
     * @returns Tag if found, undefined otherwise
     */
    async findByName(name: string): Promise<PromptTag | undefined> {
        return this.knex(this.tableName)
            .whereRaw('LOWER(name) = ?', [name.toLowerCase()])
            .first();
    }

    /**
     * Find an existing tag by name or create a new one.
     * @param name - Tag name
     * @param color - Tag color in hex format
     * @param userId - User ID for audit columns
     * @returns Existing or newly created tag
     */
    async findOrCreate(name: string, color: string, userId?: string): Promise<PromptTag> {
        // First try to find existing tag
        const existing = await this.findByName(name);
        if (existing) {
            return existing;
        }

        // Create new tag
        const tagData: Partial<PromptTag> = {
            name: name.trim(),
            color,
            created_by: userId || null,
            updated_by: userId || null
        };

        return this.create(tagData);
    }

    /**
     * Find multiple tags by their IDs.
     * @param ids - Array of tag UUIDs
     * @returns Array of tags
     */
    async findByIds(ids: string[]): Promise<PromptTag[]> {
        if (!ids || ids.length === 0) return [];
        return this.knex(this.tableName)
            .whereIn('id', ids);
    }

    /**
     * Find multiple tags by their names and return them.
     * Creates any tags that don't exist with random colors.
     * @param names - Array of tag names
     * @param userId - User ID for audit columns
     * @returns Array of tags (existing + newly created)
     */
    async findOrCreateMany(names: string[], userId?: string): Promise<PromptTag[]> {
        if (!names || names.length === 0) return [];

        const results: PromptTag[] = [];

        for (const name of names) {
            // Generate random color for new tags
            const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
            const tag = await this.findOrCreate(name.trim(), randomColor, userId);
            results.push(tag);
        }

        return results;
    }
}
