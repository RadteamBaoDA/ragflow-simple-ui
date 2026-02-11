import type { Knex } from 'knex';

/**
 * Migration: Glossary Management tables.
 * Creates glossary_tasks and glossary_keywords tables
 * for the prompt builder's glossary management feature.
 * Keywords are standalone entities (not linked to tasks).
 */
export async function up(knex: Knex): Promise<void> {
    // 1. Glossary Tasks — parent entity holding prompt template instructions
    if (!(await knex.schema.hasTable('glossary_tasks'))) {
        await knex.schema.createTable('glossary_tasks', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('name').unique().notNullable();
            table.text('description');
            table.text('task_instruction_en').notNullable();   // Task instruction in English
            table.text('task_instruction_ja');                 // Task instruction in Japanese (optional)
            table.text('task_instruction_vi');                 // Task instruction in Vietnamese (optional)
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

    // 2. Glossary Keywords — standalone keyword entities
    if (!(await knex.schema.hasTable('glossary_keywords'))) {
        await knex.schema.createTable('glossary_keywords', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('name').unique().notNullable();
            table.text('en_keyword');                     // English translation of the keyword
            table.text('description');
            table.integer('sort_order').defaultTo(0);
            table.boolean('is_active').defaultTo(true);
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

            table.index('is_active');
            table.index('sort_order');
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    // Drop in reverse order
    await knex.schema.dropTableIfExists('glossary_keywords');
    await knex.schema.dropTableIfExists('glossary_tasks');
}
