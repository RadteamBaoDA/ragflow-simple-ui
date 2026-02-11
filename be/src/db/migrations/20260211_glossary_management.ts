import type { Knex } from 'knex';

/**
 * Migration: Glossary Management tables.
 * Creates glossary_tasks (parent) and glossary_keywords (child) tables
 * for the prompt builder's glossary management feature.
 */
export async function up(knex: Knex): Promise<void> {
    // 1. Glossary Tasks — parent entity holding prompt template instructions
    if (!(await knex.schema.hasTable('glossary_tasks'))) {
        await knex.schema.createTable('glossary_tasks', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('name').unique().notNullable();
            table.text('description');
            table.text('task_instruction').notNullable();  // Line 1: what the AI should do
            table.text('context_template').notNullable();  // Line 2: keyword + context ({keyword} placeholder)
            table.integer('sort_order').defaultTo(0);
            table.boolean('is_active').defaultTo(true);
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

            table.index('name');
            table.index('is_active');
            table.index('sort_order');
        });
    }

    // 2. Glossary Keywords — child of glossary_tasks
    if (!(await knex.schema.hasTable('glossary_keywords'))) {
        await knex.schema.createTable('glossary_keywords', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('task_id').notNullable();
            table.text('name').notNullable();
            table.text('description');
            table.integer('sort_order').defaultTo(0);
            table.boolean('is_active').defaultTo(true);
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

            table.unique(['task_id', 'name']);
            table.foreign('task_id').references('glossary_tasks.id').onDelete('CASCADE');
            table.index('task_id');
            table.index('is_active');
            table.index('sort_order');
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    // Drop in reverse order to satisfy foreign key constraints
    await knex.schema.dropTableIfExists('glossary_keywords');
    await knex.schema.dropTableIfExists('glossary_tasks');
}
