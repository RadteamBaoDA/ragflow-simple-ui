/**
 * @fileoverview Manual migration script.
 * 
 * This script provides a way to manually trigger database migrations
 * outside of the normal server startup flow.
 * 
 * Use cases:
 * - Initial database setup before first server start
 * - Running migrations in CI/CD pipelines
 * - Troubleshooting migration issues
 * 
 * Usage: npx tsx src/scripts/migrate.ts
 * 
 * @module scripts/migrate
 */

import { getAdapter, closePool } from '../db/index.js';
import { runMigrations } from '../db/migrations/runner.js';
import { log } from '../services/logger.service.js';

/**
 * Main migration script entry point.
 * Runs all pending migrations and exits.
 */
async function main() {
  try {
    log.info('Starting manual migration...');
    
    // Initialize database adapter
    const db = await getAdapter();
    
    // Execute pending migrations
    await runMigrations(db);
    
    log.info('Manual migration completed successfully');
    
    // Cleanup and exit
    await closePool();
    process.exit(0);
  } catch (error) {
    log.error('Manual migration failed', { error });
    await closePool();
    process.exit(1);
  }
}

main();
