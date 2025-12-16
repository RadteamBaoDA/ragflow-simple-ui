/**
 * @fileoverview Audit log migration.
 * 
 * Creates a table to track all user actions that modify database or configuration.
 * Provides comprehensive audit trail for security and compliance reporting.
 * 
 * Features:
 * - Records user actions with timestamps
 * - Tracks resource type and ID affected
 * - Stores action details as JSON for flexibility
 * - Captures IP address for security auditing
 * - Indexed for efficient querying and pagination
 * 
 * @module db/migrations/006_audit_logs
 */

import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

/**
 * Audit log migration.
 * Creates audit_logs table to track user actions.
 */
export const migration: Migration = {
    name: '006_audit_logs',
    
    /**
     * Apply migration: Create audit_logs table.
     * 
     * Table structure:
     * - id: Auto-increment primary key
     * - user_id: Reference to users table (nullable for system actions)
     * - user_email: User email at time of action (denormalized for history)
     * - action: Action type (e.g., 'create', 'update', 'delete', 'login')
     * - resource_type: Type of resource affected (e.g., 'user', 'bucket', 'file')
     * - resource_id: ID of the affected resource (optional)
     * - details: JSON object with action-specific details
     * - ip_address: Client IP from X-Forwarded-For header
     * - created_at: Timestamp of the action
     * 
     * Indexes:
     * - user_id for filtering by user
     * - action for filtering by action type
     * - resource_type for filtering by resource
     * - created_at for time-based queries and pagination
     */
    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 006_audit_logs');

        // PostgreSQL schema
        await db.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id TEXT,
                user_email TEXT NOT NULL,
                action TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                resource_id TEXT,
                details JSONB DEFAULT '{}',
                ip_address TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // Create indexes for efficient querying
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
            ON audit_logs(user_id)
        `);
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
            ON audit_logs(action)
        `);
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type 
            ON audit_logs(resource_type)
        `);
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
            ON audit_logs(created_at DESC)
        `);
        // Composite index for common query pattern
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created_user 
            ON audit_logs(created_at DESC, user_id)
        `);

        log.info('Migration 006_audit_logs completed successfully');
    },

    /**
     * Reverse migration: Drop audit_logs table.
     */
    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 006_audit_logs');
        await db.query('DROP TABLE IF EXISTS audit_logs');
    }
};
