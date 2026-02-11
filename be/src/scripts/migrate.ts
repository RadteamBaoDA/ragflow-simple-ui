import knex from 'knex';
import dbConfig from '@/shared/db/knexfile.js';

async function migrate() {
    console.log('Starting migration...');
    const db = knex(dbConfig);
    try {
        await db.migrate.latest();
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

migrate();
