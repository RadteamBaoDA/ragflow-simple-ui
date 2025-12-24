/**
 * @fileoverview Migration to create tables for RAGFlow history.
 *
 * Creates:
 * - ragflow_chat_history: Stores chat history from external clients.
 * - ragflow_search_history: Stores search history from external clients.
 *
 * @module db/migrations/002_create_ragflow_history_tables
 */

import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

export const migration: Migration = {
    name: '002_create_ragflow_history_tables',

    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 002_create_ragflow_history_tables');

        // 1. RAGFlow Chat History
        await db.query(`
            CREATE TABLE IF NOT EXISTS ragflow_chat_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id TEXT NOT NULL,
                user_prompt TEXT NOT NULL,
                llm_response TEXT NOT NULL,
                citation_info JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_ragflow_chat_history_session_id ON ragflow_chat_history(session_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_ragflow_chat_history_created_at ON ragflow_chat_history(created_at DESC)');

        // 2. RAGFlow Search History
        await db.query(`
            CREATE TABLE IF NOT EXISTS ragflow_search_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id TEXT,
                search_input TEXT NOT NULL,
                ai_summary TEXT,
                file_name_result JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_ragflow_search_history_session_id ON ragflow_search_history(session_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_ragflow_search_history_created_at ON ragflow_search_history(created_at DESC)');

        log.info('RAGFlow history tables created successfully');
    },

    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 002_create_ragflow_history_tables');

        await db.query('DROP TABLE IF EXISTS ragflow_search_history');
        await db.query('DROP TABLE IF EXISTS ragflow_chat_history');
    }
};
