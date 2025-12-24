/**
 * @fileoverview Database abstraction layer for the Knowledge Base backend.
 * 
 * This module provides a unified interface for database operations using PostgreSQL.
 * 
 * Key features:
 * - Adapter pattern for database operations
 * - Connection pooling for PostgreSQL
 * - Lazy initialization of database connections
 * 
 * @module db
 * @example
 * import { query, queryOne, getAdapter } from './db/index.js';
 * 
 * // Simple query
 * const users = await query<User>('SELECT * FROM users');
 * 
 * // Query with parameters
 * const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);
 */

import { config } from '@/config/index.js';
import { PostgreSQLAdapter } from '@/db/adapters/postgresql.js';
import { DatabaseAdapter } from '@/db/types.js';
import { log } from '@/services/logger.service.js';

/** Singleton database adapter instance */
let adapter: DatabaseAdapter | null = null;

/**
 * Initialize database adapter based on configuration
 */
async function initializeAdapter(): Promise<DatabaseAdapter> {
  if (adapter) return adapter;

  const pgAdapter = new PostgreSQLAdapter({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
  });

  const connected = await pgAdapter.checkConnection();
  if (!connected) {
    throw new Error('PostgreSQL connection check failed');
  }

  adapter = pgAdapter;
  log.info('Database: PostgreSQL', { host: config.database.host, database: config.database.name });
  return adapter;
}

/**
 * Get the database adapter (lazy initialization)
 */
export async function getAdapter(): Promise<DatabaseAdapter> {
  if (!adapter) {
    return await initializeAdapter();
  }
  return adapter;
}

/**
 * Execute a query with automatic client release
 */
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const db = await getAdapter();
  return db.query<T>(text, params);
}

/**
 * Execute a query and return the first row only.
 * Useful for queries expected to return a single result (by ID, unique constraint).
 * 
 * @template T - The expected row type
 * @param text - SQL query string with $1, $2, etc. placeholders
 * @param params - Parameter values to substitute into query
 * @returns First row of results or undefined if no rows
 * 
 * @example
 * const user = await queryOne<User>('SELECT * FROM users WHERE email = $1', ['john@example.com']);
 * if (user) {
 *   console.log(user.display_name);
 * }
 */
export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | undefined> {
  const db = await getAdapter();
  return db.queryOne<T>(text, params);
}

/**
 * Get a database client for transaction support.
 * The client must be released after use to return it to the pool.
 * 
 * @returns Database client with query and release methods
 * 
 * @example
 * const client = await getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('INSERT INTO ...');
 *   await client.query('UPDATE ...');
 *   await client.query('COMMIT');
 * } catch (err) {
 *   await client.query('ROLLBACK');
 *   throw err;
 * } finally {
 *   client.release();
 * }
 */
export async function getClient() {
  const db = await getAdapter();
  return db.getClient();
}

/**
 * Close the database connection pool.
 * Should be called during graceful shutdown to properly release resources.
 */
export async function closePool(): Promise<void> {
  if (adapter) {
    await adapter.close();
    adapter = null;
  }
}

/**
 * Check database connectivity.
 * Attempts to execute a simple query to verify the connection is working.
 * 
 * @returns True if connected, false if connection failed
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const db = await getAdapter();
    return await db.checkConnection();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Database connection check failed', { error: errorMessage });
    return false;
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use getAdapter() instead. Database now uses adapter pattern.
 * Kept for backward compatibility with older code.
 * @returns null (always)
 */
export function getPool() {
  log.warn('getPool() is deprecated, database now uses adapter pattern');
  return null;
}

/**
 * Convenience object for database operations.
 * Provides an alternative syntax: db.query() instead of query()
 */
export const db = {
  /** Execute a query and return all rows */
  query,
  /** Execute a query and return first row */
  queryOne,
  /** Get a client for transaction support */
  getClient,
};
