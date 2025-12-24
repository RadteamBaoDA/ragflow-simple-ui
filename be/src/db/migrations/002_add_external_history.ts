/**
 * @fileoverview Migration to add external chat and search history tables.
 */

import { Migration } from '@/db/migrations/types.js';
import { DatabaseAdapter } from '@/db/types.js';
import { log } from '@/services/logger.service.js';

export const migration: Migration = {
    name: '002_add_external_history',

    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 002_add_external_history');

        // 1. External Chat History
        await db.query(`
            CREATE TABLE IF NOT EXISTS external_chat_history (
                id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::TEXT),
                session_id TEXT NOT NULL,
                user_id TEXT,
                prompt TEXT,
                response TEXT,
                citations JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_ext_chat_session ON external_chat_history(session_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_ext_chat_user ON external_chat_history(user_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_ext_chat_created ON external_chat_history(created_at)');

        // 2. External Search History
        await db.query(`
            CREATE TABLE IF NOT EXISTS external_search_history (
                id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::TEXT),
                session_id TEXT NOT NULL,
                user_id TEXT,
                query TEXT,
                summary TEXT,
                results JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_ext_search_session ON external_search_history(session_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_ext_search_user ON external_search_history(user_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_ext_search_created ON external_search_history(created_at)');

        log.info('External history tables created successfully');
    },

    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 002_add_external_history');

        await db.query('DROP TABLE IF EXISTS external_search_history');
        await db.query('DROP TABLE IF EXISTS external_chat_history');
    }
};
