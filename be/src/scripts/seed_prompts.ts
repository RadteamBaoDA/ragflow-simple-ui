
import knex from 'knex';
import dbConfig from '../db/knexfile.js';

async function runPromptsSeed() {
    console.log('Running ONLY prompts seed...');
    const db = knex(dbConfig);
    try {
        await db.seed.run({ specific: '03_prompts.ts' });
        console.log('Prompts seed executed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Seed execution failed:', err);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

runPromptsSeed();
