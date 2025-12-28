import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    if (await knex.schema.hasTable('minio_buckets')) {
        await knex.schema.alterTable('minio_buckets', (table) => {
            table.text('updated_by'); // Audit: Who updated it
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    if (await knex.schema.hasTable('minio_buckets')) {
        await knex.schema.alterTable('minio_buckets', (table) => {
            table.dropColumn('updated_by');
        });
    }
}
