/**
 * @fileoverview Rename 'Manager' role to 'Leader'.
 * 
 * This migration updates existing user records to reflect the role name change.
 * 
 * @module db/migrations/009_rename_manager_role
 */

import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

/**
 * Rename manager role migration.
 */
export const migration: Migration = {
    name: '009_rename_manager_role',

    /**
     * Apply migration: Update 'manager' to 'leader'.
     */
    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 009_rename_manager_role');

        await db.query(`
            UPDATE users 
            SET role = 'leader', updated_at = NOW() 
            WHERE role = 'manager'
        `);
    },

    /**
     * Reverse migration: Revert 'leader' back to 'manager'.
     */
    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 009_rename_manager_role');

        await db.query(`
            UPDATE users 
            SET role = 'manager', updated_at = NOW() 
            WHERE role = 'leader'
        `);
    }
};
