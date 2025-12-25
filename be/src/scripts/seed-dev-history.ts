/**
 * @fileoverview Dev-only seed script for AI chat and search history.
 * 
 * This script:
 * 1. Ensures 'session_id' column exists in 'external_search_history' (dev-only modification)
 * 2. Generates 100 mock users
 * 3. Generates 100,000 chat history records (1,000 per user)
 * 4. Generates 100,000 search history records (1,000 per user)
 * 
 * Usage: npx tsx be/src/scripts/seed-dev-history.ts
 * 
 * @module scripts/seed-dev-history
 */

import { getAdapter } from '../db/index.js';
import { log } from '../services/logger.service.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Configuration
// ============================================================================

const TOTAL_USERS = 10;
const RECORDS_PER_USER = 100;
const BATCH_SIZE = 100;

// ============================================================================
// Helper Functions
// ============================================================================

function randomDate(): Date {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return new Date(oneMonthAgo.getTime() + Math.random() * (now.getTime() - oneMonthAgo.getTime()));
}

function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

// ============================================================================
// Main Seed Function
// ============================================================================

async function seedDevHistory() {
    log.info('Starting dev history seed script...', {
        users: TOTAL_USERS,
        recordsPerUser: RECORDS_PER_USER
    });

    const db = await getAdapter();
    const startTime = Date.now();

    // 1. Ensure schema is ready (Add session_id to external_search_history if missing)
    log.info('Checking schema for external_search_history...');
    try {
        await db.query(`
            ALTER TABLE external_search_history 
            ADD COLUMN IF NOT EXISTS session_id TEXT
        `);
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_external_search_history_session_id 
            ON external_search_history(session_id)
        `);
        log.info('Schema verified (session_id column exists)');
    } catch (error) {
        log.error('Failed to ensure schema', { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
    }

    // 2. Clear existing mock data (Optional, but helps for clean tests)
    // log.info('Cleaning up existing mock data...');
    // await db.query("DELETE FROM external_chat_history");
    // await db.query("DELETE FROM external_search_history");
    // await db.query("DELETE FROM users WHERE email LIKE 'mock_user_%'");

    // 3. Generate 100 Users
    log.info(`Generating ${TOTAL_USERS} mock users...`);
    const userIds: string[] = [];
    for (let i = 1; i <= TOTAL_USERS; i++) {
        const id = uuidv4();
        const email = `mock_user_${i.toString().padStart(3, '0')}@baoda.vn`;
        const displayName = `Mock User ${i}`;

        await db.query(
            'INSERT INTO users (id, email, display_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id',
            [id, email, displayName, 'user']
        );
        userIds.push(id);
    }

    // 4. Generate History
    const SESSIONS_PER_USER = 5;
    const MESSAGES_PER_SESSION = 20;

    const samplePrompts = [
        'How do I use RAGFlow?',
        'What is an LLM?',
        'Explain vector databases',
        'How to optimize AI search?',
        'What is the meaning of life?',
        'Tell me a joke about coding',
        'How to run nodejs 22?',
        'What is Knex ORM?',
        'How to handle concurrency in Bee-Queue?',
        'Can you summarize the document?'
    ];

    const sampleResponses = [
        'RAGFlow is an open-source UI for AI search and chat.',
        'LLM stands for Large Language Model, like GPT-4.',
        'Vector databases store high-dimensional embeddings.',
        'To optimize AI search, use hybrid search and reranking.',
        '42.',
        'Why do programmers prefer dark mode? Because light attracts bugs!',
        'Use nvm to install node 22.',
        'Knex is a SQL query builder for Node.js.',
        'Use the concurrency setting in the queue.process() method.',
        'The document discusses advanced agentic coding techniques.'
    ];

    const sampleInputs = [
        'AI trends 2025',
        'Ragflow documentation',
        'Node.js concurrency best practices',
        'Vector DB vs Graph DB',
        'PostgreSQL performance tuning',
        'TypeScript utility types',
        'Express middleware guide',
        'MinIO setup on docker',
        'Redis session storage',
        'Langfuse observability'
    ];

    // Bulk insert history to save time
    const TOTAL_RECORDS = TOTAL_USERS * SESSIONS_PER_USER * MESSAGES_PER_SESSION;
    log.info(`Seeding ${TOTAL_RECORDS} chat history records (${SESSIONS_PER_USER} sessions/user, ${MESSAGES_PER_SESSION} msgs/session)...`);

    let chatCount = 0;
    for (const userId of userIds) {
        const chatBatch = [];

        for (let s = 0; s < SESSIONS_PER_USER; s++) {
            const sessionId = uuidv4();
            const sessionDate = randomDate(); // Same date for all messages in this session

            for (let m = 0; m < MESSAGES_PER_SESSION; m++) {
                chatBatch.push({
                    session_id: sessionId,
                    email: `mock_user_${(userIds.indexOf(userId) + 1).toString().padStart(3, '0')}@baoda.vn`,
                    user_prompt: randomElement(samplePrompts),
                    llm_response: randomElement(sampleResponses),
                    citations: JSON.stringify([]),
                    created_at: sessionDate // Shared date for grouping
                });
            }
        }

        // Insert in batches
        for (let i = 0; i < chatBatch.length; i += BATCH_SIZE) {
            const chunk = chatBatch.slice(i, i + BATCH_SIZE);
            const placeholders = chunk.map((_, idx) => `($${idx * 6 + 1}, $${idx * 6 + 2}, $${idx * 6 + 3}, $${idx * 6 + 4}, $${idx * 6 + 5}, $${idx * 6 + 6})`).join(', ');
            const values = chunk.flatMap(r => [r.session_id, r.email, r.user_prompt, r.llm_response, r.citations, r.created_at.toISOString()]);
            await db.query(`INSERT INTO external_chat_history (session_id, email, user_prompt, llm_response, citations, created_at) VALUES ${placeholders}`, values);
            chatCount += chunk.length;
            process.stdout.write(`\rUsers processed: ${userIds.indexOf(userId) + 1}/${TOTAL_USERS} (Chats: ${chatCount})`);
        }
    }
    console.log();

    log.info(`Seeding ${TOTAL_RECORDS} search history records...`);
    let searchCount = 0;
    for (const userId of userIds) {
        const searchBatch = [];

        for (let s = 0; s < SESSIONS_PER_USER; s++) {
            const sessionId = uuidv4();
            const sessionDate = randomDate(); // Same date for all records in this session

            for (let m = 0; m < MESSAGES_PER_SESSION; m++) {
                searchBatch.push({
                    session_id: sessionId,
                    email: `mock_user_${(userIds.indexOf(userId) + 1).toString().padStart(3, '0')}@baoda.vn`,
                    search_input: randomElement(sampleInputs),
                    ai_summary: randomElement(sampleResponses),
                    file_results: JSON.stringify([]),
                    created_at: sessionDate // Shared date for grouping
                });
            }
        }

        // Insert in batches
        for (let i = 0; i < searchBatch.length; i += BATCH_SIZE) {
            const chunk = searchBatch.slice(i, i + BATCH_SIZE);
            if (chunk.length === 0) continue;

            const placeholders = chunk.map((_, idx) => `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5})`).join(', ');
            const values = chunk.flatMap(r => [r.session_id, r.email, r.search_input, r.ai_summary, r.file_results]);

            await db.query(`INSERT INTO external_search_history (session_id, email, search_input, ai_summary, file_results) VALUES ${placeholders}`, values);
            searchCount += chunk.length;
            process.stdout.write(`\rUsers processed: ${userIds.indexOf(userId) + 1}/${TOTAL_USERS} (Searches: ${searchCount})`);
        }
    }
    console.log();

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log.info('Dev history seed completed successfully!', {
        totalUsers: userIds.length,
        totalChats: chatCount,
        totalSearches: searchCount,
        time: `${totalTime}s`
    });

    process.exit(0);
}

// Run the script
seedDevHistory().catch((error) => {
    log.error('Seed script failed', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
});
