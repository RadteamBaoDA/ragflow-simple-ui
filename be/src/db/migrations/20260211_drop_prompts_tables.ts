/**
 * @fileoverview Drop prompt-related tables.
 * The prompts feature has been replaced by the glossary feature.
 * Tables dropped: prompt_permissions, prompt_tags, prompt_interactions, prompts
 */
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('prompt_permissions')
    await knex.schema.dropTableIfExists('prompt_tags')
    await knex.schema.dropTableIfExists('prompt_interactions')
    await knex.schema.dropTableIfExists('prompts')
}

export async function down(knex: Knex): Promise<void> {
    // Recreate tables in dependency order
    if (!(await knex.schema.hasTable('prompts'))) {
        await knex.schema.createTable('prompts', (table) => {
            table.uuid('id').primary().defaultTo(knex.fn.uuid())
            table.text('prompt').notNullable()
            table.text('description')
            table.jsonb('tags').defaultTo('[]')
            table.string('source').defaultTo('custom')
            table.boolean('is_active').defaultTo(true)
            table.string('created_by')
            table.string('updated_by')
            table.timestamps(true, true)
            table.specificType('search_vector', "tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(prompt, '') || ' ' || coalesce(description, ''))) STORED")
        })
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_prompts_search_vector ON prompts USING GIN(search_vector)')
    }

    if (!(await knex.schema.hasTable('prompt_interactions'))) {
        await knex.schema.createTable('prompt_interactions', (table) => {
            table.uuid('id').primary().defaultTo(knex.fn.uuid())
            table.uuid('prompt_id').notNullable()
            table.string('user_id').notNullable()
            table.enum('interaction_type', ['like', 'dislike', 'comment']).notNullable()
            table.text('comment')
            table.text('prompt_snapshot')
            table.timestamps(true, true)
            table.foreign('prompt_id').references('prompts.id').onDelete('CASCADE')
            table.index(['prompt_id', 'interaction_type'])
        })
    }

    if (!(await knex.schema.hasTable('prompt_tags'))) {
        await knex.schema.createTable('prompt_tags', (table) => {
            table.uuid('id').primary().defaultTo(knex.fn.uuid())
            table.string('name').notNullable().unique()
            table.string('color')
            table.string('created_by')
            table.string('updated_by')
            table.timestamps(true, true)
        })
    }

    if (!(await knex.schema.hasTable('prompt_permissions'))) {
        await knex.schema.createTable('prompt_permissions', (table) => {
            table.uuid('id').primary().defaultTo(knex.fn.uuid())
            table.string('entity_type').notNullable()
            table.string('entity_id').notNullable()
            table.integer('permission_level').notNullable().defaultTo(0)
            table.string('created_by')
            table.timestamps(true, true)
            table.unique(['entity_type', 'entity_id'])
        })
        await knex.raw('ALTER TABLE prompt_permissions ADD CONSTRAINT prompt_permissions_permission_level_check CHECK (permission_level BETWEEN 0 AND 3)')
    }
}
