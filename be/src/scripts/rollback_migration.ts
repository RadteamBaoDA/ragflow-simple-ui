import knex from 'knex';
import dbConfig from '@/shared/db/knexfile.js';

async function rollbackMigration() {
    console.log('Starting rollback...');
    const db = knex(dbConfig);
    try {
        await db.migrate.rollback();
        console.log('Rollback completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Rollback failed:', err);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

rollbackMigration();
