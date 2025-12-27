import knex from 'knex';
import dbConfig from '../db/knexfile.js';

async function runSeeds() {
    console.log('Starting seed execution...');
    const db = knex(dbConfig);
    try {
        await db.seed.run();
        console.log('All seeds executed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Seed execution failed:', err);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

runSeeds();
