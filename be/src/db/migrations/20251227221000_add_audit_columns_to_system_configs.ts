import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    if (await knex.schema.hasTable('system_configs')) {
        await knex.schema.alterTable('system_configs', (table) => {
            table.text('created_by'); // Audit: Who created it, nullable for system init
            table.text('updated_by'); // Audit: Who updated it, nullable
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    if (await knex.schema.hasTable('system_configs')) {
        await knex.schema.alterTable('system_configs', (table) => {
            table.dropColumn('created_by');
            table.dropColumn('updated_by');
        });
    }
}
