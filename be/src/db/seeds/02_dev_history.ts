/**
 * @fileoverview Seed script for dev history data.
 * 
 * Generates mock users, chat history, and search history.
 */

import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';

const TOTAL_USERS = 10;
const SESSIONS_PER_USER = 5;
const MESSAGES_PER_SESSION = 20;
const BATCH_SIZE = 100;

function randomDate(): Date {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return new Date(oneMonthAgo.getTime() + Math.random() * (now.getTime() - oneMonthAgo.getTime()));
}

function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

const samplePrompts = [
    'How do I use RAGFlow?', 'What is an LLM?', 'Explain vector databases',
    'How to optimize AI search?', 'What is the meaning of life?',
    'Tell me a joke about coding', 'How to run nodejs 22?', 'What is Knex ORM?',
    'How to handle concurrency?', 'Can you summarize the document?'
];

const sampleResponses = [
    'RAGFlow is an open-source UI.', 'LLM stands for Large Language Model.',
    'Vector databases store embeddings.', 'Use hybrid search.', '42.',
    'Why do programmers prefer dark mode? Because light attracts bugs!',
    'Use nvm to install node 22.', 'Knex is a SQL query builder.',
    'Use queue concurrency settings.', 'The document discusses agentic coding.'
];

const sampleInputs = [
    'AI trends 2025', 'Ragflow documentation', 'Node.js best practices',
    'Vector DB vs Graph DB', 'PostgreSQL tuning', 'TypeScript types',
    'Express middleware', 'MinIO docker', 'Redis storage', 'Langfuse observability'
];

export async function seed(knex: Knex): Promise<void> {
    console.log('Starting dev history seed...');
    const startTime = Date.now();

    try {
        // 1. Users
        const userIds: string[] = [];
        console.log(`Generating ${TOTAL_USERS} users...`);

        for (let i = 1; i <= TOTAL_USERS; i++) {
            const id = uuidv4();
            const email = `mock_user_${i.toString().padStart(3, '0')}@baoda.vn`;
            const displayName = `Mock User ${i}`;

            // Upsert user
            await knex('users')
                .insert({
                    id,
                    email,
                    display_name: displayName,
                    role: 'user'
                })
                .onConflict('email')
                .merge(['display_name']);

            const user = await knex('users').where({ email }).select('id').first();
            if (user) userIds.push(user.id);
        }

        // 2. Chat History
        console.log('Seeding chat history...');
        const chatBatch: any[] = [];
        for (const userId of userIds) {
            const userIndex = userIds.indexOf(userId);
            const email = `mock_user_${(userIndex + 1).toString().padStart(3, '0')}@baoda.vn`;

            for (let s = 0; s < SESSIONS_PER_USER; s++) {
                const sessionId = uuidv4();
                const sessionDate = randomDate();

                for (let m = 0; m < MESSAGES_PER_SESSION; m++) {
                    chatBatch.push({
                        session_id: sessionId,
                        user_email: email, // Fixed: email -> user_email
                        user_prompt: randomElement(samplePrompts),
                        llm_response: randomElement(sampleResponses),
                        citations: JSON.stringify([]),
                        created_at: sessionDate
                    });
                }
            }
        }
        await knex.batchInsert('external_chat_history', chatBatch, BATCH_SIZE);

        // 3. Search History
        console.log('Seeding search history...');
        const searchBatch: any[] = [];
        for (const userId of userIds) {
            const userIndex = userIds.indexOf(userId);
            const email = `mock_user_${(userIndex + 1).toString().padStart(3, '0')}@baoda.vn`;

            for (let s = 0; s < SESSIONS_PER_USER; s++) {
                const sessionId = uuidv4();
                const sessionDate = randomDate();

                for (let m = 0; m < MESSAGES_PER_SESSION; m++) {
                    searchBatch.push({
                        session_id: sessionId,
                        user_email: email, // Fixed: email -> user_email
                        search_input: randomElement(sampleInputs),
                        ai_summary: randomElement(sampleResponses),
                        file_results: JSON.stringify([]),
                        created_at: sessionDate
                    });
                }
            }
        }
        await knex.batchInsert('external_search_history', searchBatch, BATCH_SIZE);

        console.log(`Dev history seed completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    } catch (error) {
        console.error('Error in dev history seed:', error);
        throw error;
    }
}
