import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    const tables = [
        'users',
        'teams',
        'chat_sessions',
        'chat_messages',
        'broadcast_messages',
        'external_chat_sessions',
        'external_chat_messages',
        'external_search_sessions',
        'external_search_records',
        // 'knowledge_base_sources', // Already valid
        // 'system_configs', // Already valid
        // 'minio_buckets', // Already valid
        // 'user_teams', // Junction table, usually doesn't need full audit
        // 'user_ip_history', // Log table
        // 'audit_logs', // Log table
        // 'document_permissions', // Has created_at/updated_at, logic might not strictly require user stamping but safest to add if based on standard Base Model
        'document_permissions',
        'prompts',
        'prompt_interactions'
    ];

    for (const tableName of tables) {
        if (await knex.schema.hasTable(tableName)) {
            await knex.schema.alterTable(tableName, (table) => {
                // Add created_by if it doesn't exist
                // Ideally checks would be specific, but standardizing on text nullable is safe for now
                // Since we can't easily check column existence in a portable synchronous way in migration builder without raw queries, 
                // and based on previous errors we know they are missing, we will attempt to add them.
                // However, to be safe against re-runs or partial states if possible (though sqlite/postgres differ), 
                // we'll rely on the standard "add column" which throws if exists.
                // Given the Agent context, I will assume they are missing based on the "initial_schema" review.

                // Specific logic per table based on review:

                if (tableName === 'users') {
                    table.text('created_by');
                    table.text('updated_by');
                } else if (tableName === 'teams') {
                    table.text('created_by');
                    table.text('updated_by');
                } else if (tableName === 'chat_sessions') {
                    table.text('created_by');
                    table.text('updated_by');
                } else if (tableName === 'chat_messages') {
                    table.text('created_by');
                    table.text('updated_by');
                } else if (tableName === 'broadcast_messages') {
                    table.text('created_by');
                    table.text('updated_by');
                } else if (tableName === 'external_chat_sessions') {
                    table.text('created_by');
                    table.text('updated_by');
                } else if (tableName === 'external_chat_messages') {
                    table.text('created_by');
                    table.text('updated_by');
                } else if (tableName === 'external_search_sessions') {
                    table.text('created_by');
                    table.text('updated_by');
                } else if (tableName === 'external_search_records') {
                    table.text('created_by');
                    table.text('updated_by');
                } else if (tableName === 'document_permissions') {
                    table.text('created_by');
                    table.text('updated_by');
                } else if (tableName === 'prompts') {
                    table.text('created_by');
                    table.text('updated_by');
                } else if (tableName === 'prompt_interactions') {
                    table.text('created_by');
                    table.text('updated_by');
                }
            });
        }
    }
}

export async function down(knex: Knex): Promise<void> {
    const tables = [
        'users',
        'teams',
        'chat_sessions',
        'chat_messages',
        'broadcast_messages',
        'external_chat_sessions',
        'external_chat_messages',
        'external_search_sessions',
        'external_search_records',
        'document_permissions',
        'prompts',
        'prompt_interactions'
    ];

    for (const tableName of tables) {
        if (await knex.schema.hasTable(tableName)) {
            await knex.schema.alterTable(tableName, (table) => {
                table.dropColumn('created_by');
                table.dropColumn('updated_by');
            });
        }
    }
}
