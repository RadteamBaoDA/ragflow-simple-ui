import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // 1. external_chat_history
    await knex.schema.alterTable('external_chat_history', table => {
        // Use coalesce to ensure no nulls propagate (though columns should be not null)
        table.specificType('search_vector', "tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(user_prompt, '') || ' ' || coalesce(llm_response, ''))) STORED");
        table.index('search_vector', 'idx_external_chat_history_search_vector', 'GIN');
    });

    // 2. external_search_history
    await knex.schema.alterTable('external_search_history', table => {
        table.specificType('search_vector', "tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(search_input, '') || ' ' || coalesce(ai_summary, ''))) STORED");
        table.index('search_vector', 'idx_external_search_history_search_vector', 'GIN');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('external_chat_history', table => {
        table.dropIndex([], 'idx_external_chat_history_search_vector'); // Knex might require array for name if custom
        table.dropColumn('search_vector');
    });

    await knex.schema.alterTable('external_search_history', table => {
        table.dropIndex([], 'idx_external_search_history_search_vector');
        table.dropColumn('search_vector');
    });
}
