import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    // 1. Users
    if (!(await knex.schema.hasTable('users'))) {
        await knex.schema.createTable('users', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('email').unique().notNullable();
            table.text('display_name').notNullable();
            table.text('role').notNullable().defaultTo('user');
            table.text('permissions').notNullable().defaultTo('[]');
            table.text('department');
            table.text('job_title');
            table.text('mobile_phone');
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        });
    }

    // 2. Teams
    if (!(await knex.schema.hasTable('teams'))) {
        await knex.schema.createTable('teams', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('name').notNullable();
            table.text('project_name');
            table.text('description');
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        });
    }

    // 3. User Teams Junction
    if (!(await knex.schema.hasTable('user_teams'))) {
        await knex.schema.createTable('user_teams', (table) => {
            table.text('user_id').notNullable();
            table.text('team_id').notNullable();
            table.text('role').notNullable().defaultTo('member');
            table.timestamp('joined_at', { useTz: true }).defaultTo(knex.fn.now());
            table.primary(['user_id', 'team_id']);
            table.foreign('user_id').references('users.id').onDelete('CASCADE');
            table.foreign('team_id').references('teams.id').onDelete('CASCADE');
            table.index('user_id');
            table.index('team_id');
        });
    }

    // 4. Chat Sessions
    if (!(await knex.schema.hasTable('chat_sessions'))) {
        await knex.schema.createTable('chat_sessions', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('user_id').notNullable();
            table.text('title').notNullable();
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
            table.foreign('user_id').references('users.id').onDelete('CASCADE');
        });
    }

    // 5. Chat Messages
    if (!(await knex.schema.hasTable('chat_messages'))) {
        await knex.schema.createTable('chat_messages', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('session_id').notNullable();
            table.text('role').notNullable();
            table.text('content').notNullable();
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('timestamp', { useTz: true }).defaultTo(knex.fn.now());
            table.foreign('session_id').references('chat_sessions.id').onDelete('CASCADE');
        });
    }

    // 7. System Configs
    if (!(await knex.schema.hasTable('system_configs'))) {
        await knex.schema.createTable('system_configs', (table) => {
            table.text('key').primary();
            table.text('value').notNullable();
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        });
    }

    // 8. Knowledge Base Sources
    if (!(await knex.schema.hasTable('knowledge_base_sources'))) {
        await knex.schema.createTable('knowledge_base_sources', (table) => {
            table.text('id').primary().defaultTo(knex.raw('gen_random_uuid()::TEXT'));
            table.text('type').notNullable();
            table.text('name').notNullable();
            table.text('url').notNullable();
            table.text('description'); // Source description
            table.text('share_id'); // Share ID extracted from URL (shared_id param)
            table.text('chat_widget_url'); // URL for embedded chat widget on search page
            table.jsonb('access_control').defaultTo('{"public": true}');
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        });
    }

    // 9. Audit Logs
    if (!(await knex.schema.hasTable('audit_logs'))) {
        await knex.schema.createTable('audit_logs', (table) => {
            table.increments('id').primary();
            table.text('user_id');
            table.text('user_email').notNullable();
            table.text('action').notNullable();
            table.text('resource_type').notNullable();
            table.text('resource_id');
            table.jsonb('details').defaultTo('{}');
            table.text('ip_address');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

            table.index('user_id');
            table.index('action');
            table.index('resource_type');
            table.index('created_at');
        });
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)');
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_user ON audit_logs(created_at DESC, user_id)');
    }

    // 10. User IP History
    if (!(await knex.schema.hasTable('user_ip_history'))) {
        await knex.schema.createTable('user_ip_history', (table) => {
            table.increments('id').primary();
            table.text('user_id').notNullable();
            table.text('ip_address').notNullable();
            table.timestamp('last_accessed_at', { useTz: true }).defaultTo(knex.fn.now());
            table.unique(['user_id', 'ip_address']);
            table.foreign('user_id').references('users.id').onDelete('CASCADE');
            table.index('user_id');
        });
    }

    // 12. Broadcast Messages
    if (!(await knex.schema.hasTable('broadcast_messages'))) {
        await knex.schema.createTable('broadcast_messages', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.text('message').notNullable();
            table.timestamp('starts_at', { useTz: true }).notNullable();
            table.timestamp('ends_at', { useTz: true }).notNullable();
            table.string('color', 50).defaultTo('#E75E40');
            table.string('font_color', 50).defaultTo('#FFFFFF');
            table.boolean('is_active').defaultTo(true);
            table.boolean('is_dismissible').defaultTo(true);
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
            table.index(['is_active', 'starts_at', 'ends_at']);
        });
    }

    // 13. User Dismissed Broadcasts
    if (!(await knex.schema.hasTable('user_dismissed_broadcasts'))) {
        await knex.schema.createTable('user_dismissed_broadcasts', (table) => {
            table.text('user_id').notNullable();
            table.uuid('broadcast_id').notNullable();
            table.timestamp('dismissed_at', { useTz: true }).defaultTo(knex.fn.now());
            table.primary(['user_id', 'broadcast_id']);
            table.foreign('user_id').references('users.id').onDelete('CASCADE');
            table.foreign('broadcast_id').references('broadcast_messages.id').onDelete('CASCADE');
            table.index('user_id');
        });
    }

    // 14. External Chat Sessions
    if (!(await knex.schema.hasTable('external_chat_sessions'))) {
        await knex.schema.createTable('external_chat_sessions', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.text('session_id').unique().notNullable(); // Unique constraint for session upsert
            table.text('share_id'); // Share ID of the source
            table.text('user_email');
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

            table.index('share_id');
            table.index('user_email');
        });
    }

    // 15. External Chat Messages
    if (!(await knex.schema.hasTable('external_chat_messages'))) {
        await knex.schema.createTable('external_chat_messages', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.text('session_id').notNullable(); // Reference to session_id (not FK to avoid constraint issues if session created async, but logically linked)
            table.text('user_prompt').notNullable();
            table.text('llm_response').notNullable();
            table.jsonb('citations').defaultTo('[]');
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            // Full-text search vector
            table.specificType('search_vector', "tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(user_prompt, '') || ' ' || coalesce(llm_response, ''))) STORED");

            table.index('session_id');
            table.foreign('session_id').references('external_chat_sessions.session_id').onDelete('CASCADE');
        });
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_ext_chat_msg_created_at ON external_chat_messages(created_at DESC)');
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_ext_chat_msg_search_vector ON external_chat_messages USING GIN(search_vector)');
    }

    // 16. External Search Sessions
    if (!(await knex.schema.hasTable('external_search_sessions'))) {
        await knex.schema.createTable('external_search_sessions', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.text('session_id').unique().notNullable();
            table.text('share_id'); // Share ID of the source
            table.text('user_email');
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

            table.index('share_id');
            table.index('user_email');
        });
    }

    // 17. External Search Records
    if (!(await knex.schema.hasTable('external_search_records'))) {
        await knex.schema.createTable('external_search_records', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.text('session_id').notNullable();
            table.text('search_input').notNullable();
            table.text('ai_summary');
            table.jsonb('file_results').defaultTo('[]');
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            // Full-text search vector
            table.specificType('search_vector', "tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(search_input, '') || ' ' || coalesce(ai_summary, ''))) STORED");

            table.index('session_id');
            table.foreign('session_id').references('external_search_sessions.session_id').onDelete('CASCADE');
        });
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_ext_search_rec_created_at ON external_search_records(created_at DESC)');
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_ext_search_rec_search_vector ON external_search_records USING GIN(search_vector)');
    }

    // 18. Prompts
    if (!(await knex.schema.hasTable('prompts'))) {
        await knex.schema.createTable('prompts', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.text('prompt').notNullable();
            table.text('description');
            table.jsonb('tags').defaultTo('[]');
            table.text('source').defaultTo('chat'); // 'chat' or custom source
            table.boolean('is_active').defaultTo(true);
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

            // Full-text search for prompt and description
            table.specificType('search_vector', "tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(prompt, '') || ' ' || coalesce(description, ''))) STORED");
            table.index('source');
        });
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_prompts_search_vector ON prompts USING GIN(search_vector)');
    }

    // 19. Prompt Interactions (Likes/Dislikes/Comments)
    if (!(await knex.schema.hasTable('prompt_interactions'))) {
        await knex.schema.createTable('prompt_interactions', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('prompt_id').notNullable();
            table.text('user_id'); // nullable if we want to allow anonymous feedback or system feedback, but typically should be linked to user. specific requirements said "info store feedback from user"
            table.text('interaction_type').notNullable().checkIn(['like', 'dislike', 'comment']);
            table.text('comment'); // Only populated if type is 'comment'
            table.text('prompt_snapshot'); // Snapshot of prompt text at interaction time for history tracking
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

            table.foreign('prompt_id').references('prompts.id').onDelete('CASCADE');
            table.index(['prompt_id', 'interaction_type']);
        });
    }

    // 20. Prompt Tags
    if (!(await knex.schema.hasTable('prompt_tags'))) {
        await knex.schema.createTable('prompt_tags', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.text('name').unique().notNullable();
            table.text('color').notNullable();
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
            table.index('name');
            table.index('created_at');
        });
    }

    // 21. Prompt Permissions
    if (!(await knex.schema.hasTable('prompt_permissions'))) {
        await knex.schema.createTable('prompt_permissions', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.string('entity_type', 10).notNullable().checkIn(['user', 'team']);
            table.text('entity_id').notNullable();
            table.integer('permission_level').notNullable().defaultTo(0);
            table.text('created_by');
            table.text('updated_by');
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
            table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
            table.unique(['entity_type', 'entity_id']);
            table.index(['entity_type', 'entity_id']);
        });
        await knex.raw('ALTER TABLE prompt_permissions ADD CONSTRAINT prompt_permissions_permission_level_check CHECK (permission_level BETWEEN 0 AND 3)');
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('prompt_permissions');
    await knex.schema.dropTableIfExists('prompt_tags');
    await knex.schema.dropTableIfExists('prompt_interactions');
    await knex.schema.dropTableIfExists('prompts');
    await knex.schema.dropTableIfExists('external_search_records');
    await knex.schema.dropTableIfExists('external_search_sessions');
    await knex.schema.dropTableIfExists('external_chat_messages');
    await knex.schema.dropTableIfExists('external_chat_sessions');
    await knex.schema.dropTableIfExists('user_dismissed_broadcasts');
    await knex.schema.dropTableIfExists('broadcast_messages');
    await knex.schema.dropTableIfExists('user_ip_history');
    await knex.schema.dropTableIfExists('audit_logs');
    await knex.schema.dropTableIfExists('knowledge_base_sources');
    await knex.schema.dropTableIfExists('system_configs');
    await knex.schema.dropTableIfExists('chat_messages');
    await knex.schema.dropTableIfExists('chat_sessions');
    await knex.schema.dropTableIfExists('user_teams');
    await knex.schema.dropTableIfExists('teams');
    await knex.schema.dropTableIfExists('users');
}
