/**
 * @fileoverview Schema migration for external chat and search history.
 *
 * This migration creates the following tables:
 * - external_chat_history: Stores chat history from external clients.
 * - external_search_history: Stores search history from external clients.
 *
 * @module db/migrations/002_external_history_schema
 */

import { Migration } from '@/db/migrations/types.js';
import { DatabaseAdapter } from '@/db/types.js';
import { log } from '@/services/logger.service.js';

export const migration: Migration = {
    name: '002_external_history_schema',

    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 002_external_history_schema');

        // 1. External Chat History
        await db.query(`
            CREATE TABLE IF NOT EXISTS external_chat_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id TEXT NOT NULL,
                user_prompt TEXT NOT NULL,
                llm_response TEXT NOT NULL,
                citations JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_external_chat_history_session_id ON external_chat_history(session_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_external_chat_history_created_at ON external_chat_history(created_at DESC)');

        // 2. External Search History
        await db.query(`
            CREATE TABLE IF NOT EXISTS external_search_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                search_input TEXT NOT NULL,
                ai_summary TEXT,
                file_results JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_external_search_history_created_at ON external_search_history(created_at DESC)');

        log.info('External history schema created successfully');
    },

    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 002_external_history_schema');

        await db.query('DROP TABLE IF EXISTS external_search_history');
        await db.query('DROP TABLE IF EXISTS external_chat_history');
    }
};
