/**
 * @fileoverview PostgreSQL database adapter implementation.
 * 
 * This module provides a PostgreSQL-specific implementation of the DatabaseAdapter interface.
 * It uses the 'pg' library with connection pooling for efficient database operations.
 * 
 * Features:
 * - Connection pooling with configurable pool size
 * - Automatic connection management
 * - Error handling and logging
 * - Transaction support via client acquisition
 * 
 * @module db/adapters/postgresql
 */

import { Pool, PoolClient } from 'pg';
import { DatabaseAdapter, DatabaseClient } from '../types.js';
import { log } from '../../services/logger.service.js';

/**
 * PostgreSQL database adapter.
 * Implements the DatabaseAdapter interface for PostgreSQL databases.
 * 
 * Uses connection pooling for efficient resource management:
 * - Max 20 concurrent connections
 * - 30 second idle timeout
 * - 2 second connection timeout
 * 
 * @implements {DatabaseAdapter}
 * 
 * @example
 * const adapter = new PostgreSQLAdapter({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'mydb',
 *   user: 'postgres',
 *   password: 'secret'
 * });
 * 
 * const users = await adapter.query<User>('SELECT * FROM users');
 */
export class PostgreSQLAdapter implements DatabaseAdapter {
    /** PostgreSQL connection pool instance */
    private pool: Pool;

    /**
     * Creates a new PostgreSQL adapter with connection pool.
     * 
     * @param config - PostgreSQL connection configuration
     * @param config.host - Database server hostname
     * @param config.port - Database server port
     * @param config.database - Database name
     * @param config.user - Database username
     * @param config.password - Database password
     */
    constructor(config: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
    }) {
        log.debug('Creating PostgreSQL connection pool', {
            host: config.host,
            port: config.port,
            database: config.database,
        });

        // Initialize connection pool with performance-tuned settings
        this.pool = new Pool({
            ...config,
            max: 20,                      // Maximum pool size
            idleTimeoutMillis: 30000,     // Close idle clients after 30s
            connectionTimeoutMillis: 2000, // Fail fast on connection issues
        });

        // Log pool errors (connection issues, etc.)
        this.pool.on('error', (err) => {
            log.error('Unexpected error on idle PostgreSQL client', { error: err.message });
        });
    }

    /**
     * Execute a query and return all matching rows.
     * Automatically acquires and releases a connection from the pool.
     * 
     * @template T - Expected row type
     * @param text - SQL query with $1, $2, etc. placeholders
     * @param params - Parameter values for placeholders
     * @returns Array of result rows
     */
    async query<T>(text: string, params?: unknown[]): Promise<T[]> {
        const result = await this.pool.query(text, params);
        return result.rows as T[];
    }

    /**
     * Execute a query and return only the first row.
     * Convenience method for single-row queries.
     * 
     * @template T - Expected row type
     * @param text - SQL query with placeholders
     * @param params - Parameter values
     * @returns First row or undefined
     */
    async queryOne<T>(text: string, params?: unknown[]): Promise<T | undefined> {
        const rows = await this.query<T>(text, params);
        return rows[0];
    }

    /**
     * Acquire a dedicated client from the pool for transaction support.
     * The returned client MUST be released after use.
     * 
     * @returns Database client wrapper with query and release methods
     */
    async getClient(): Promise<DatabaseClient> {
        const client = await this.pool.connect();
        return {
            query: async <T>(text: string, params?: unknown[]) => {
                const result = await client.query(text, params);
                return result.rows as T[];
            },
            release: () => client.release(),
        };
    }

    /**
     * Close all connections in the pool.
     * Call during graceful shutdown to release database resources.
     */
    async close(): Promise<void> {
        await this.pool.end();
    }

    /**
     * Verify database connectivity with a simple query.
     * 
     * @returns True if connection successful, false otherwise
     */
    async checkConnection(): Promise<boolean> {
        try {
            await this.query('SELECT 1');
            log.debug('PostgreSQL connection check successful');
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.error('PostgreSQL connection check failed', { error: errorMessage });
            return false;
        }
    }
}
