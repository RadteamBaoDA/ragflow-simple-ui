/**
 * @fileoverview MinIO buckets table migration.
 * 
 * This migration creates the minio_buckets table for tracking
 * configured MinIO storage buckets. The table stores metadata
 * about buckets that are managed through the application.
 * 
 * Table structure:
 * - id: Unique identifier (UUID)
 * - bucket_name: MinIO bucket name (must be unique)
 * - display_name: Human-readable name for UI
 * - description: Optional bucket description
 * - created_by: Reference to user who created it
 * - created_at: Creation timestamp
 * - is_active: Soft delete flag
 * 
 * @module db/migrations/004_create_minio_buckets
 */

import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

/**
 * MinIO buckets table migration.
 * Creates table for tracking MinIO bucket configurations.
 */
export const migration: Migration = {
  name: '004_create_minio_buckets',
  
  /**
   * Apply migration: Create minio_buckets table.
   * 
   * The table stores MinIO bucket metadata with:
   * - Foreign key to users table for created_by
   * - Unique constraint on bucket_name to prevent duplicates
   * - is_active flag for soft deletes
   */
  async up(db: DatabaseAdapter): Promise<void> {
    log.info('Running migration: 004_create_minio_buckets');

    // PostgreSQL: Use TIMESTAMP WITH TIME ZONE for proper timezone handling
    await db.query(`
        CREATE TABLE IF NOT EXISTS minio_buckets (
            id TEXT PRIMARY KEY,
            bucket_name TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            description TEXT,
            created_by TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    `);

    log.info('Created minio_buckets table');
  },

  /**
   * Reverse migration: Drop minio_buckets table.
   * Warning: This will delete all bucket metadata (actual MinIO data is not affected).
   */
  async down(db: DatabaseAdapter): Promise<void> {
    log.info('Reverting migration: 004_create_minio_buckets');
    await db.query('DROP TABLE IF EXISTS minio_buckets');
    log.info('Dropped minio_buckets table');
  }
};
