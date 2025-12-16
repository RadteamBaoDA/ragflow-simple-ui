/**
 * @fileoverview RBAC (Role-Based Access Control) update migration.
 * 
 * This migration adds role and permissions columns to the users table
 * if they don't already exist. This handles the case where the initial
 * schema might have been created without these columns.
 * 
 * @module db/migrations/002_rbac_update
 */

import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

/**
 * RBAC update migration.
 * Ensures users table has role and permissions columns.
 */
export const migration: Migration = {
    name: '002_rbac_update',
    
    /**
     * Apply migration: Add role and permissions columns to users table.
     * 
     * PostgreSQL supports ALTER TABLE ADD COLUMN IF NOT EXISTS.
     */
    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 002_rbac_update');

        // PostgreSQL: Use IF NOT EXISTS clause (PostgreSQL 9.6+)
        await db.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
        ADD COLUMN IF NOT EXISTS permissions TEXT NOT NULL DEFAULT '[]'
      `);
    },

    /**
     * Reverse migration: Remove role and permissions columns.
     */
    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 002_rbac_update');
        
        // PostgreSQL supports DROP COLUMN IF EXISTS
        await db.query('ALTER TABLE users DROP COLUMN IF EXISTS role');
        await db.query('ALTER TABLE users DROP COLUMN IF EXISTS permissions');
    }
};
