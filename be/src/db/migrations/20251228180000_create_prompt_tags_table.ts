import { Knex } from 'knex';

/**
 * Migration: Create prompt_tags table for storing reusable tags with colors.
 * Also updates prompts.tags to store array of tag UUIDs instead of tag names.
 */
export async function up(knex: Knex): Promise<void> {
    // 1. Create prompt_tags table
    if (!(await knex.schema.hasTable('prompt_tags'))) {
        await knex.schema.createTable('prompt_tags', (table) => {
            // Primary key - UUID
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            // Tag name - unique and required
            table.text('name').unique().notNullable();
            // Color in hex format (e.g., #FF5733)
            table.text('color').notNullable();
            // Audit columns
            table.text('created_by');
            table.text('updated_by');
            // Timestamps
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
            // Index for faster name searches
            table.index('name');
            table.index('created_at');
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    // Drop prompt_tags table
    await knex.schema.dropTableIfExists('prompt_tags');
}
