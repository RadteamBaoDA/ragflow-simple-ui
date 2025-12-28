import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    if (await knex.schema.hasTable('knowledge_base_sources')) {
        await knex.schema.alterTable('knowledge_base_sources', (table) => {
            // Check if columns exist before adding them to be safe
            // However, knex doesn't support 'ifNotExists' on addColumn directly in all drivers easily within the builder chain without raw checks
            // But we know they are missing based on the error.
            // Using implicit check logic or try/catch effectively, but standard knex migration usually assumes state.

            table.text('created_by'); // Audit: Who created it
            table.text('updated_by'); // Audit: Who updated it
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    if (await knex.schema.hasTable('knowledge_base_sources')) {
        await knex.schema.alterTable('knowledge_base_sources', (table) => {
            table.dropColumn('created_by');
            table.dropColumn('updated_by');
        });
    }
}
