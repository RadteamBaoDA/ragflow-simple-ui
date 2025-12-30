
import { promptService } from '../services/prompt.service.js';
import { db } from '../db/knex.js';

async function debug() {
    try {
        console.log('--- Starting Debug ---');

        // 1. Get the specific prompt
        const promptsResult = await promptService.getPrompts({ search: 'Cybersecurity' });
        let prompts = promptsResult.data; // Access .data property
        if (prompts.length === 0) {
            console.log('No prompts found matching "Cybersecurity". Listing first 5 prompts:');
            const result = await promptService.getPrompts({});
            prompts = result.data; // Redefine prompts with all prompts' data
            console.log(`Found ${result.total} prompts`);
            // List first 5
            const all = prompts;
            all.slice(0, 5).forEach((p: any) => console.log(`- ${p.prompt} (${p.id})`));

            if (prompts.length === 0) {
                console.log('No prompts found, creating test prompt...');
                return;
            }
        }
        const prompt = prompts[0];
        if (!prompt) return;
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
