
/**
 * GlossaryKeywordModel — Data access layer for glossary_keywords table.
 * Extends BaseModel for standard CRUD and adds custom query methods.
 * @module models/glossary-keyword.model
 */
import { Knex } from 'knex';
import { BaseModel } from '@/models/base.model.js';
import { GlossaryKeyword } from '@/models/types.js';
import { db } from '@/db/knex.js';

/**
 * Model for glossary_keywords table operations.
 * Keywords belong to a single glossary task (hierarchical).
 */
export class GlossaryKeywordModel extends BaseModel<GlossaryKeyword> {
    protected tableName = 'glossary_keywords';
    protected knex: Knex = db;

    /**
     * Find all keywords belonging to a specific task.
     * @param taskId - UUID of the parent task
     * @returns Array of keywords sorted by sort_order then name
     */
    async findByTaskId(taskId: string): Promise<GlossaryKeyword[]> {
        return this.knex(this.tableName)
            .where({ task_id: taskId })
            .orderBy('sort_order', 'asc')
            .orderBy('name', 'asc');
    }

    /**
     * Search keywords by name across all tasks (case-insensitive).
     * Used by the Prompt Builder search feature.
     * @param query - Search query string
     * @param limit - Maximum results to return
     * @returns Array of matching keywords
     */
    async searchByName(query: string, limit = 50): Promise<GlossaryKeyword[]> {
        return this.knex(this.tableName)
            .whereRaw('LOWER(name) LIKE ?', [`%${query.toLowerCase()}%`])
            .orderBy('name', 'asc')
            .limit(limit);
    }

    /**
     * Find a keyword by exact name within a specific task.
     * @param taskId - UUID of the parent task
     * @param name - Exact keyword name
     * @returns Keyword if found, undefined otherwise
     */
    async findByName(taskId: string, name: string): Promise<GlossaryKeyword | undefined> {
        return this.knex(this.tableName)
            .where({ task_id: taskId })
            .whereRaw('LOWER(name) = ?', [name.toLowerCase()])
            .first();
    }

    /**
     * Bulk create multiple keywords for a task within a transaction.
     * Skips duplicates (by task_id + name).
     * @param taskId - UUID of the parent task
     * @param keywords - Array of keyword data to insert
     * @param userId - User performing the action
     * @param trx - Optional Knex transaction
     * @returns Array of created keywords
     */
    async bulkCreate(
        taskId: string,
        keywords: Array<{ name: string; description?: string }>,
        userId?: string,
        trx?: Knex.Transaction
    ): Promise<GlossaryKeyword[]> {
        const results: GlossaryKeyword[] = [];
        const queryBuilder = trx || this.knex;

        for (const kw of keywords) {
            // Check for existing keyword in this task
            const existing = await queryBuilder(this.tableName)
                .where({ task_id: taskId })
                .whereRaw('LOWER(name) = ?', [kw.name.toLowerCase().trim()])
                .first();

            if (existing) {
                // Skip duplicate
                results.push(existing);
                continue;
            }

            // Insert new keyword
            const [created] = await queryBuilder(this.tableName)
                .insert({
                    task_id: taskId,
                    name: kw.name.trim(),
                    description: kw.description || null,
                    created_by: userId || null,
                    updated_by: userId || null,
                })
                .returning('*');

            results.push(created);
        }

        return results;
    }
}
