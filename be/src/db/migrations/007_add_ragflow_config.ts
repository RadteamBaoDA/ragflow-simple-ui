/**
 * @fileoverview Migration to add RAGFlow configuration tables.
 * 
 * Creates tables for storing:
 * - System-wide configurations (key-value pairs)
 * - RAGFlow chat/search sources
 * 
 * @module db/migrations/002_add_ragflow_config
 */

import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

export const migration: Migration = {
    name: '007_add_ragflow_config',

    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 007_add_ragflow_config');

        // System Configs Table
        // Stores generic key-value settings like 'ai_chat_url', 'ai_search_url'
        await db.query(`
            CREATE TABLE IF NOT EXISTS system_configs (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // RAGFlow Sources Table
        // Stores available chat and search sources
        await db.query(`
            CREATE TABLE IF NOT EXISTS ragflow_sources (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL, -- 'chat' or 'search'
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
    },

    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 007_add_ragflow_config');
        await db.query('DROP TABLE IF EXISTS ragflow_sources');
        await db.query('DROP TABLE IF EXISTS system_configs');
    }
};
