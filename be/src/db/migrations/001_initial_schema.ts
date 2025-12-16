/**
 * @fileoverview Initial database schema migration.
 * 
 * Creates the foundational tables for the Knowledge Base application:
 * - users: User accounts and profile information
 * - chat_sessions: Chat conversation containers
 * - chat_messages: Individual messages within chat sessions
 * 
 * @module db/migrations/001_initial_schema
 */

import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

/**
 * Initial schema migration.
 * Creates users, chat_sessions, and chat_messages tables.
 */
export const migration: Migration = {
    name: '001_initial_schema',
    
    /**
     * Apply migration: Create initial database tables.
     * 
     * Tables created:
     * - users: Stores user accounts with email, display name, role, and permissions
     * - chat_sessions: Groups chat messages into sessions with titles
     * - chat_messages: Individual user/assistant messages with timestamps
     * 
     * All tables use TEXT for IDs (UUIDs) and include created_at/updated_at timestamps.
     * Foreign key constraints ensure referential integrity.
     */
    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 001_initial_schema');

        // Users table: Core user account information
        await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          permissions TEXT NOT NULL DEFAULT '[]',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

        // Chat sessions: Container for grouping related messages
        await db.query(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

        // Chat messages: Individual messages within sessions
        await db.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        )
      `);
    },

    /**
     * Reverse migration: Drop all tables.
     * Tables must be dropped in reverse order due to foreign key constraints.
     */
    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 001_initial_schema');
        // Drop in reverse order of dependencies
        await db.query('DROP TABLE IF EXISTS chat_messages');
        await db.query('DROP TABLE IF EXISTS chat_sessions');
        await db.query('DROP TABLE IF EXISTS users');
    }
};
