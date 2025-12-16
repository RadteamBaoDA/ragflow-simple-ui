/**
 * @fileoverview Add user details migration.
 * 
 * This migration adds additional profile fields to the users table
 * that are synced from Azure AD user profiles:
 * - department: User's organizational department
 * - job_title: User's job title/position
 * - mobile_phone: User's mobile phone number
 * 
 * These fields are nullable as they may not be available for all users.
 * 
 * @module db/migrations/003_add_user_details
 */

import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

/**
 * User details migration.
 * Adds Azure AD profile fields to users table.
 */
export const migration: Migration = {
    name: '003_add_user_details',
    
    /**
     * Apply migration: Add department, job_title, and mobile_phone columns.
     * 
     * Uses separate ALTER TABLE statements for cross-database compatibility.
     * Each column is added in a try-catch to handle cases where it might
     * already exist from a previous partial migration.
     */
    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 003_add_user_details');

        // Add department column (user's organizational unit)
        try {
            await db.query('ALTER TABLE users ADD COLUMN department TEXT');
        } catch (e) {
            log.warn('Failed to add department column (might already exist)', { error: e });
        }

        // Add job_title column (user's position/role in organization)
        try {
            await db.query('ALTER TABLE users ADD COLUMN job_title TEXT');
        } catch (e) {
            log.warn('Failed to add job_title column (might already exist)', { error: e });
        }

        // Add mobile_phone column (user's contact number)
        try {
            await db.query('ALTER TABLE users ADD COLUMN mobile_phone TEXT');
        } catch (e) {
            log.warn('Failed to add mobile_phone column (might already exist)', { error: e });
        }
    },

    /**
     * Reverse migration: Remove user detail columns.
     */
    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 003_add_user_details');

        try {
            await db.query('ALTER TABLE users DROP COLUMN department');
            await db.query('ALTER TABLE users DROP COLUMN job_title');
            await db.query('ALTER TABLE users DROP COLUMN mobile_phone');
        } catch (e) {
            log.warn('Failed to drop columns (might not be supported by this DB version)', { error: e });
        }
    }
};
