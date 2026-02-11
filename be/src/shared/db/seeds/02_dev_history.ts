/**
 * @fileoverview Seed script for dev history data.
 *
 * Generates mock users, external chat sessions/messages, and external search sessions/records.
 * Matches the current schema: external_chat_sessions + external_chat_messages,
 * external_search_sessions + external_search_records.
 */

import { Knex } from 'knex'
import { v4 as uuidv4 } from 'uuid'

const TOTAL_USERS = 10
const SESSIONS_PER_USER = 5
const MESSAGES_PER_SESSION = 20
const BATCH_SIZE = 100

/**
 * Generate a random date within the last 30 days.
 * @returns Random Date object
 */
function randomDate(): Date {
    const now = new Date()
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    return new Date(oneMonthAgo.getTime() + Math.random() * (now.getTime() - oneMonthAgo.getTime()))
}

/**
 * Pick a random element from an array.
 * @param arr - Source array
 * @returns Random element
 */
function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!
}

// Sample share IDs to link sessions to knowledge base sources
const sampleShareIds = [
    'share_001', 'share_002', 'share_003', 'share_004', 'share_005'
]

const samplePrompts = [
    'How do I use RAGFlow?', 'What is an LLM?', 'Explain vector databases',
    'How to optimize AI search?', 'What is the meaning of life?',
    'Tell me a joke about coding', 'How to run nodejs 22?', 'What is Knex ORM?',
    'How to handle concurrency?', 'Can you summarize the document?'
]

const sampleResponses = [
    'RAGFlow is an open-source UI.', 'LLM stands for Large Language Model.',
    'Vector databases store embeddings.', 'Use hybrid search.', '42.',
    'Why do programmers prefer dark mode? Because light attracts bugs!',
    'Use nvm to install node 22.', 'Knex is a SQL query builder.',
    'Use queue concurrency settings.', 'The document discusses agentic coding.'
]

const sampleInputs = [
    'AI trends 2025', 'Ragflow documentation', 'Node.js best practices',
    'Vector DB vs Graph DB', 'PostgreSQL tuning', 'TypeScript types',
    'Express middleware', 'MinIO docker', 'Redis storage', 'Langfuse observability'
]

/**
 * Seed function for dev history: users, external chat sessions/messages,
 * and external search sessions/records.
 *
 * @param knex - Knex instance for database operations
 * @returns Promise<void>
 */
export async function seed(knex: Knex): Promise<void> {
    console.log('Starting dev history seed...')
    const startTime = Date.now()

    try {
        // ========================================
        // 1. Users
        // ========================================
        const userEmails: string[] = []
        console.log(`Generating ${TOTAL_USERS} users...`)

        for (let i = 1; i <= TOTAL_USERS; i++) {
            const id = uuidv4()
            const email = `mock_user_${i.toString().padStart(3, '0')}@baoda.vn`
            const displayName = `Mock User ${i}`

            // Upsert user by email
            await knex('users')
                .insert({
                    id,
                    email,
                    display_name: displayName,
                    role: 'user'
                })
                .onConflict('email')
                .merge(['display_name'])

            userEmails.push(email)
        }

        // ========================================
        // 2. External Chat Sessions + Messages
        // ========================================
        console.log('Seeding external chat sessions and messages...')
        const chatSessionBatch: any[] = []
        const chatMessageBatch: any[] = []

        for (const email of userEmails) {
            for (let s = 0; s < SESSIONS_PER_USER; s++) {
                const sessionId = uuidv4()
                const sessionDate = randomDate()

                // Insert session record
                chatSessionBatch.push({
                    id: uuidv4(),
                    session_id: sessionId,
                    share_id: randomElement(sampleShareIds),
                    user_email: email,
                    created_at: sessionDate,
                    updated_at: sessionDate
                })

                // Insert messages for this session
                for (let m = 0; m < MESSAGES_PER_SESSION; m++) {
                    chatMessageBatch.push({
                        id: uuidv4(),
                        session_id: sessionId,
                        user_prompt: randomElement(samplePrompts),
                        llm_response: randomElement(sampleResponses),
                        citations: JSON.stringify([]),
                        created_at: new Date(sessionDate.getTime() + m * 60000) // 1 min apart
                    })
                }
            }
        }

        // Batch insert sessions first (FK dependency)
        await knex.batchInsert('external_chat_sessions', chatSessionBatch, BATCH_SIZE)
        await knex.batchInsert('external_chat_messages', chatMessageBatch, BATCH_SIZE)

        // ========================================
        // 3. External Search Sessions + Records
        // ========================================
        console.log('Seeding external search sessions and records...')
        const searchSessionBatch: any[] = []
        const searchRecordBatch: any[] = []

        for (const email of userEmails) {
            for (let s = 0; s < SESSIONS_PER_USER; s++) {
                const sessionId = uuidv4()
                const sessionDate = randomDate()

                // Insert session record
                searchSessionBatch.push({
                    id: uuidv4(),
                    session_id: sessionId,
                    share_id: randomElement(sampleShareIds),
                    user_email: email,
                    created_at: sessionDate,
                    updated_at: sessionDate
                })

                // Insert search records for this session
                for (let m = 0; m < MESSAGES_PER_SESSION; m++) {
                    searchRecordBatch.push({
                        id: uuidv4(),
                        session_id: sessionId,
                        search_input: randomElement(sampleInputs),
                        ai_summary: randomElement(sampleResponses),
                        file_results: JSON.stringify([]),
                        created_at: new Date(sessionDate.getTime() + m * 60000)
                    })
                }
            }
        }

        // Batch insert sessions first (FK dependency)
        await knex.batchInsert('external_search_sessions', searchSessionBatch, BATCH_SIZE)
        await knex.batchInsert('external_search_records', searchRecordBatch, BATCH_SIZE)

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(`Dev history seed completed in ${elapsed}s`)
        console.log(`  - Chat sessions: ${chatSessionBatch.length}, messages: ${chatMessageBatch.length}`)
        console.log(`  - Search sessions: ${searchSessionBatch.length}, records: ${searchRecordBatch.length}`)
    } catch (error) {
        console.error('Error in dev history seed:', error)
        throw error
    }
}
