/**
 * @fileoverview User IP history migration.
 * 
 * Creates a table to track user access IPs collected via nginx proxy.
 * Stores unique IPs per user with last access timestamp.
 * 
 * Features:
 * - One record per unique IP per user
 * - Last access time updated on each access
 * - Index for efficient user lookups
 * 
 * @module db/migrations/005_user_ip_history
 */

import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

/**
 * User IP history migration.
 * Creates user_ip_history table to track access IPs.
 */
export const migration: Migration = {
    name: '005_user_ip_history',
    
    /**
     * Apply migration: Create user_ip_history table.
     * 
     * Table structure:
     * - id: Auto-increment primary key
     * - user_id: Reference to users table
     * - ip_address: Client IP from X-Forwarded-For header
     * - last_accessed_at: Timestamp of last access from this IP
     * 
     * Constraints:
     * - UNIQUE(user_id, ip_address): One record per IP per user
     * - Foreign key to users with CASCADE delete
     * - Index on user_id for efficient lookups
     */
    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 005_user_ip_history');

        // PostgreSQL schema
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_ip_history (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                ip_address TEXT NOT NULL,
                last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(user_id, ip_address),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Create index for efficient user lookups
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_user_ip_history_user_id 
            ON user_ip_history(user_id)
        `);
    },

    /**
     * Reverse migration: Drop user_ip_history table.
     */
    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 005_user_ip_history');
        await db.query('DROP TABLE IF EXISTS user_ip_history');
    }
};
