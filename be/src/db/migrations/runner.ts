/**
 * @fileoverview Database migration runner.
 * 
 * This module handles the execution of database migrations in order.
 * It tracks which migrations have been applied and only runs pending ones.
 * 
 * Migration features:
 * - Automatic migrations table creation
 * - Idempotent execution (safe to run multiple times)
 * - Ordered execution based on migration name prefixes (001_, 002_, etc.)
 * - PostgreSQL database support
 * - Failure stops migration process to prevent partial state
 * 
 * @module db/migrations/runner
 */

import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';
import { migration as migration001 } from './001_initial_schema.js';

/**
 * Ordered list of all migrations.
 * Migrations are executed in array order (which should match numerical prefixes).
 * 
 * To add a new migration:
 * 1. Create a new file: 002_your_migration.ts
 * 2. Import it here: import { migration as migration002 } from './002_your_migration.js';
 * 3. Add to this array: migration002
 */
const migrations = [
  migration001,  // Initial schema: users, chat_sessions, chat_messages, knowledge_base_sources, etc.
];

/**
 * Run all pending database migrations.
 * 
 * This function:
 * 1. Creates the migrations tracking table if it doesn't exist
 * 2. Queries for already-executed migrations
 * 3. Runs each pending migration in order
 * 4. Records successful migrations in the tracking table
 * 
 * @param db - Database adapter instance
 * @throws Error if any migration fails (stops execution)
 * 
 * @example
 * const db = await getAdapter();
 * await runMigrations(db);
 */
export async function runMigrations(db: DatabaseAdapter): Promise<void> {
  log.info('Checking for pending migrations...');

  // Create migrations tracking table
  await db.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Get list of already-executed migrations
  const executedMigrations = await db.query<{ name: string }>('SELECT name FROM migrations');
  const executedNames = new Set(executedMigrations.map(m => m.name));

  // Execute each pending migration
  for (const migration of migrations) {
    if (!executedNames.has(migration.name)) {
      log.info(`Applying migration: ${migration.name}`);
      try {
        // Execute the migration's up() function
        await migration.up(db);

        // Record successful migration
        await db.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
        log.info(`Migration applied: ${migration.name}`);
      } catch (error) {
        log.error(`Migration failed: ${migration.name}`, { error });
        throw error; // Stop migration process on failure
      }
    } else {
      log.debug(`Migration already applied: ${migration.name}`);
    }
  }

  log.info('All migrations checked/applied');
}
