import knex from 'knex';
import dbConfig from '@/shared/db/knexfile.js';

async function makeMigration() {
    const name = process.argv[2];
    if (!name) {
        console.error('Error: Migration name is required.');
        console.error('Usage: npm run db:migrate:make <migration_name>');
        process.exit(1);
    }

    const db = knex(dbConfig);
    try {
        const res = await db.migrate.make(name, { extension: 'ts' });
        console.log(`Migration created: ${res}`);
        process.exit(0);
    } catch (err) {
        console.error('Failed to create migration:', err);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

makeMigration();
