
import { promptService } from '../services/prompt.service.js';
import { db } from '../db/knex.js';

async function debug() {
    try {
        console.log('--- Starting Debug ---');

        // 1. Get the specific prompt
        const prompts = await promptService.getPrompts({ search: 'Cybersecurity' });
        if (prompts.length === 0) {
            console.log('No prompts found matching "Cybersecurity". Listing first 5 prompts:');
            const all = await promptService.getPrompts();
            all.slice(0, 5).forEach(p => console.log(`- ${p.prompt} (${p.id})`));
            return;
        }
        const prompt = prompts[0];
        console.log(`Found prompt: ${prompt.id} (${prompt.prompt})`);

        // Check raw interactions count in DB
        const count = await db('prompt_interactions').where('prompt_id', prompt.id).count('* as c').first();
        console.log(`Raw DB count for prompt ${prompt.id}:`, count?.c);

        // 3. Fetch interactions via service
        console.log('Fetching interactions via service...');
        const interactions = await promptService.getInteractionsForPrompt(prompt.id);
        console.log('Interactions result count:', interactions.length);
        console.log('Interactions result:', JSON.stringify(interactions, null, 2));

    } catch (err) {
        console.error('Debug failed:', err);
    } finally {
        await db.destroy();
    }
}

debug();
