
/**
 * GlossaryKeywordModel — Data access layer for glossary_keywords table.
 * Extends BaseModel for standard CRUD and adds custom query methods.
 * Keywords are standalone entities (not linked to tasks).
 * @module models/glossary-keyword.model
 */
import { Knex } from 'knex';
import { BaseModel } from '@/models/base.model.js';
import { GlossaryKeyword } from '@/models/types.js';
import { db } from '@/db/knex.js';

/**
 * Model for glossary_keywords table operations.
 * Keywords are standalone entities in the glossary system.
 */
export class GlossaryKeywordModel extends BaseModel<GlossaryKeyword> {
    protected tableName = 'glossary_keywords';
    protected knex: Knex = db;

    /**
     * Search keywords by name (case-insensitive).
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
     * Find a keyword by exact name (case-insensitive).
     * @param name - Exact keyword name
     * @returns Keyword if found, undefined otherwise
     */
    async findByName(name: string): Promise<GlossaryKeyword | undefined> {
        return this.knex(this.tableName)
            .whereRaw('LOWER(name) = ?', [name.toLowerCase()])
            .first();
    }

    /**
     * Bulk create multiple keywords within a transaction.
     * Skips duplicates by name.
     * @param keywords - Array of keyword data to insert
     * @param userId - User performing the action
     * @param trx - Optional Knex transaction
     * @returns Array of created keywords
     */
    async bulkCreate(
        keywords: Array<{ name: string; en_keyword?: string; description?: string }>,
        userId?: string,
        trx?: Knex.Transaction
    ): Promise<GlossaryKeyword[]> {
        const results: GlossaryKeyword[] = [];
        const queryBuilder = trx || this.knex;

        for (const kw of keywords) {
            // Check for existing keyword by name
            const existing = await queryBuilder(this.tableName)
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
                    name: kw.name.trim(),
                    en_keyword: kw.en_keyword || null,
                    description: kw.description || null,
                    created_by: userId || null,
                    updated_by: userId || null,
                })
                .returning('*');

            results.push(created);
        }

        return results;
    }

    /**
     * Bulk insert a chunk of keyword rows within a single transaction.
     * Skips duplicates by name (case-insensitive) using both the DB and a seen Set.
     * @param rows - Array of keyword rows to insert
     * @param seen - Set of already-processed names (lowercase) for cross-chunk dedup
     * @param userId - User performing the import
     * @returns Object with created and skipped counts
     */
    async bulkInsertChunk(
        rows: Array<{ name: string; en_keyword?: string; description?: string }>,
        seen: Set<string>,
        userId?: string,
    ): Promise<{ created: number; skipped: number }> {
        let created = 0;
        let skipped = 0;

        await this.knex.transaction(async (trx) => {
            for (const row of rows) {
                const name = row.name?.trim();
                if (!name) {
                    skipped++;
                    continue;
                }

                // Skip if already seen in this import
                const nameLower = name.toLowerCase();
                if (seen.has(nameLower)) {
                    skipped++;
                    continue;
                }
                seen.add(nameLower);

                // Check if keyword already exists in DB (using trx)
                const existing = await trx(this.tableName)
                    .whereRaw('LOWER(name) = ?', [nameLower])
                    .first();
                if (existing) {
                    skipped++;
                    continue;
                }

                // Insert keyword
                await trx(this.tableName).insert({
                    name,
                    en_keyword: row.en_keyword?.trim() || null,
                    description: row.description?.trim() || null,
                    created_by: userId || null,
                    updated_by: userId || null,
                });
                created++;
            }
        });

        return { created, skipped };
    }
}
