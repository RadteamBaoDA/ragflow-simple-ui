
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

    /**
     * Update an existing tag's name and/or color.
     * Also performs a cascading update on the prompts table
     * if the tag name changes.
     * @param id - Tag UUID
     * @param name - New tag name
     * @param color - New tag color
     * @param userId - User ID for audit columns
     * @returns Updated tag
     * @throws Error if tag not found or name conflict
     */
    async updateTag(id: string, name: string, color: string, userId?: string): Promise<PromptTag> {
        // Use transaction for atomicity
        return this.knex.transaction(async trx => {
            // Find existing tag
            const existing = await trx(this.tableName).where('id', id).first();
            if (!existing) {
                throw new Error('Tag not found');
            }

            const oldName = existing.name;
            const newName = name.trim();

            // Check for duplicate name if changing
            if (oldName.toLowerCase() !== newName.toLowerCase()) {
                const conflict = await trx(this.tableName)
                    .whereRaw('LOWER(name) = ?', [newName.toLowerCase()])
                    .whereNot('id', id)
                    .first();
                if (conflict) {
                    throw new Error('Tag name already exists');
                }

                // Cascade update: replace old name with new name in prompts.tags JSONB array
                // Uses PostgreSQL JSONB manipulation: array_replace
                await trx.raw(`
                    UPDATE prompts
                    SET tags = (
                        SELECT jsonb_agg(
                            CASE WHEN elem = ? THEN ? ELSE elem END
                        )
                        FROM jsonb_array_elements_text(tags) AS elem
                    ),
                    updated_at = NOW()
                    WHERE tags @> ?
                `, [oldName, newName, JSON.stringify([oldName])]);
            }

            // Update the tag itself
            const [updated] = await trx(this.tableName)
                .where('id', id)
                .update({
                    name: newName,
                    color,
                    updated_by: userId || null,
                    updated_at: trx.fn.now()
                })
                .returning('*');

            return updated;
        });
    }

    /**
     * Delete a tag by ID.
     * Throws if the tag is currently used by any prompts.
     * @param id - Tag UUID
     * @throws Error if tag is in use or not found
     */
    async deleteTag(id: string): Promise<void> {
        return this.knex.transaction(async trx => {
            // Find existing tag
            const existing = await trx(this.tableName).where('id', id).first();
            if (!existing) {
                throw new Error('Tag not found');
            }

            const tagName = existing.name;

            // Check if any prompts use this tag
            const usageCount = await trx('prompts')
                .whereRaw('tags @> ?', [JSON.stringify([tagName])])
                .count('id as count')
                .first();

            const count = parseInt(usageCount?.count as string || '0', 10);
            if (count > 0) {
                throw new Error(`TAG_IN_USE:${count}`);
            }

            // Delete the tag
            await trx(this.tableName).where('id', id).delete();
        });
    }
}
