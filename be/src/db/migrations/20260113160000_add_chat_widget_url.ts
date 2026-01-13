/**
 * Migration: Add chat_widget_url column to knowledge_base_sources table.
 * 
 * @description Adds a nullable chat_widget_url column to store the URL
 * for embedding a floating chat widget on the AI Search page.
 */
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    // Add chat_widget_url column to knowledge_base_sources table
    await knex.schema.alterTable('knowledge_base_sources', (table) => {
        table.text('chat_widget_url').nullable().comment('URL for embedded chat widget on search page');
    });
}

export async function down(knex: Knex): Promise<void> {
    // Remove chat_widget_url column from knowledge_base_sources table
    await knex.schema.alterTable('knowledge_base_sources', (table) => {
        table.dropColumn('chat_widget_url');
    });
}
