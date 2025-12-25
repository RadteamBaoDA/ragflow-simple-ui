/**
 * @fileoverview Schema migration to add user_email to external history tables.
 */

import { Migration } from '@/db/migrations/types.js';
import { DatabaseAdapter } from '@/db/types.js';
import { log } from '@/services/logger.service.js';

export const migration: Migration = {
    name: '003_add_email_to_external_history',

    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 003_add_email_to_external_history');

        await db.query(`
            ALTER TABLE external_chat_history 
            ADD COLUMN IF NOT EXISTS email TEXT;
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_external_chat_history_email ON external_chat_history(email)');

        await db.query(`
            ALTER TABLE external_search_history 
            ADD COLUMN IF NOT EXISTS email TEXT;
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_external_search_history_email ON external_search_history(email)');

        log.info('External history email columns added successfully');
    },

    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 003_add_email_to_external_history');

        await db.query('ALTER TABLE external_search_history DROP COLUMN IF EXISTS email');
        await db.query('ALTER TABLE external_chat_history DROP COLUMN IF EXISTS email');
    }
};
