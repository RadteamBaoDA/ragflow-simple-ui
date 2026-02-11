import type { Knex } from 'knex';

/**
 * @description Migration for project management feature.
 * Creates tables: ragflow_servers, projects, project_permissions,
 * document_categories, document_category_versions, project_chats.
 */
export async function up(knex: Knex): Promise<void> {
    // 1. RAGFlow Servers — Admin-managed RAGFlow connections
    if (!(await knex.schema.hasTable('ragflow_servers'))) {
        await knex.schema.createTable('ragflow_servers', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('name').unique().notNullable();
            table.text('endpoint_url').notNullable();
            table.text('api_key').notNullable();
            table.text('description');
            table.boolean('is_active').defaultTo(true);
            table.jsonb('embedding_models').defaultTo('[]');
            table.jsonb('chat_models').defaultTo('[]');
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        });
    }

    // 2. Projects — Central project entity
    if (!(await knex.schema.hasTable('projects'))) {
        await knex.schema.createTable('projects', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('name').notNullable();
            table.text('description');
            table.text('avatar');
            table.text('ragflow_server_id');
            table.text('default_embedding_model');
            table.text('default_chunk_method').defaultTo('naive');
            table.jsonb('default_parser_config').defaultTo('{}');
            table.text('status').defaultTo('active');
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

            table.foreign('ragflow_server_id').references('ragflow_servers.id').onDelete('SET NULL');
            table.index('ragflow_server_id');
            table.index('status');
        });
    }

    // 3. Project Permissions — Granular per-tab access
    if (!(await knex.schema.hasTable('project_permissions'))) {
        await knex.schema.createTable('project_permissions', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('project_id').notNullable();
            table.text('grantee_type').notNullable(); // 'user' | 'team'
            table.text('grantee_id').notNullable();
            table.text('tab_documents').defaultTo('none'); // none | view | manage
            table.text('tab_chat').defaultTo('none');
            table.text('tab_settings').defaultTo('none');
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

            table.foreign('project_id').references('projects.id').onDelete('CASCADE');
            table.unique(['project_id', 'grantee_type', 'grantee_id']);
            table.index('project_id');
            table.index('grantee_id');
        });
    }

    // 4. Document Categories — Categories within a project
    if (!(await knex.schema.hasTable('document_categories'))) {
        await knex.schema.createTable('document_categories', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('project_id').notNullable();
            table.text('name').notNullable();
            table.text('description');
            table.integer('sort_order').defaultTo(0);
            table.jsonb('dataset_config').defaultTo('{}');
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

            table.foreign('project_id').references('projects.id').onDelete('CASCADE');
            table.unique(['project_id', 'name']);
            table.index('project_id');
        });
    }

    // 5. Document Category Versions — Each version = 1 RAGFlow dataset
    if (!(await knex.schema.hasTable('document_category_versions'))) {
        await knex.schema.createTable('document_category_versions', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('category_id').notNullable();
            table.text('version_label').notNullable();
            table.text('ragflow_dataset_id');
            table.text('ragflow_dataset_name');
            table.text('status').defaultTo('active'); // active | archived
            table.timestamp('last_synced_at', { useTz: true });
            table.jsonb('metadata').defaultTo('{}');
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

            table.foreign('category_id').references('document_categories.id').onDelete('CASCADE');
            table.unique(['category_id', 'version_label']);
            table.index('category_id');
            table.index('ragflow_dataset_id');
        });
    }

    // 6. Project Chats — Chat assistants linked to project
    if (!(await knex.schema.hasTable('project_chats'))) {
        await knex.schema.createTable('project_chats', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('project_id').notNullable();
            table.text('name').notNullable();
            table.text('ragflow_chat_id');
            table.jsonb('dataset_ids').defaultTo('[]');
            table.jsonb('ragflow_dataset_ids').defaultTo('[]');
            table.jsonb('llm_config').defaultTo('{}');
            table.jsonb('prompt_config').defaultTo('{}');
            table.text('status').defaultTo('active');
            table.timestamp('last_synced_at', { useTz: true });
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

            table.foreign('project_id').references('projects.id').onDelete('CASCADE');
            table.index('project_id');
            table.index('ragflow_chat_id');
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    // Drop in reverse dependency order
    await knex.schema.dropTableIfExists('project_chats');
    await knex.schema.dropTableIfExists('document_category_versions');
    await knex.schema.dropTableIfExists('document_categories');
    await knex.schema.dropTableIfExists('project_permissions');
    await knex.schema.dropTableIfExists('projects');
    await knex.schema.dropTableIfExists('ragflow_servers');
}
