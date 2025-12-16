/**
 * @fileoverview Migration type definitions.
 * 
 * This module defines the interface for database migrations.
 * Each migration must implement both up() and down() methods.
 * 
 * @module db/migrations/types
 */

import { DatabaseAdapter } from '../types.js';

/**
 * Database migration interface.
 * 
 * Migrations are used to evolve the database schema over time.
 * Each migration has:
 * - A unique name (typically prefixed with a number for ordering)
 * - An up() method to apply the migration
 * - A down() method to reverse the migration (rollback)
 * 
 * @example
 * export const migration: Migration = {
 *   name: '005_add_avatar_column',
 *   async up(db) {
 *     await db.query('ALTER TABLE users ADD COLUMN avatar TEXT');
 *   },
 *   async down(db) {
 *     await db.query('ALTER TABLE users DROP COLUMN avatar');
 *   }
 * };
 */
export interface Migration {
    /**
     * Unique migration identifier.
     * Convention: XXX_description (e.g., '001_initial_schema')
     * Used to track which migrations have been applied.
     */
    name: string;
    
    /**
     * Apply the migration (forward migration).
     * Creates tables, adds columns, creates indexes, etc.
     * 
     * @param db - Database adapter for executing queries
     */
    up(db: DatabaseAdapter): Promise<void>;
    
    /**
     * Reverse the migration (rollback).
     * Drops tables, removes columns, removes indexes, etc.
     * Should exactly undo what up() does.
     * 
     * @param db - Database adapter for executing queries
     */
    down(db: DatabaseAdapter): Promise<void>;
}
