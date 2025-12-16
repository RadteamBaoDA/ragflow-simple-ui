/**
 * @fileoverview Database adapter type definitions.
 * 
 * This module defines the interfaces for database adapters,
 * enabling support for multiple database backends (PostgreSQL, SQLite).
 * 
 * The adapter pattern allows the application to use different databases
 * while maintaining a consistent API for database operations.
 * 
 * @module db/types
 */

/**
 * Database adapter interface for supporting multiple database backends.
 * 
 * Implementations must provide:
 * - Query execution with parameterized queries
 * - Single-row query helper
 * - Client acquisition for transactions
 * - Connection lifecycle management
 * 
 * @example
 * class MyDatabaseAdapter implements DatabaseAdapter {
 *   async query<T>(text: string, params?: unknown[]): Promise<T[]> {
 *     // Execute query and return rows
 *   }
 *   // ... other methods
 * }
 */
export interface DatabaseAdapter {
    /**
     * Execute a query and return all matching rows.
     * Uses parameterized queries ($1, $2, etc.) for SQL injection prevention.
     * 
     * @template T - The expected row type
     * @param text - SQL query string with parameter placeholders
     * @param params - Parameter values to substitute
     * @returns Array of result rows
     */
    query<T>(text: string, params?: unknown[]): Promise<T[]>;
    
    /**
     * Execute a query and return only the first row.
     * Useful for queries expected to return a single result.
     * 
     * @template T - The expected row type
     * @param text - SQL query string with parameter placeholders
     * @param params - Parameter values to substitute
     * @returns First row or undefined if no results
     */
    queryOne<T>(text: string, params?: unknown[]): Promise<T | undefined>;
    
    /**
     * Acquire a database client for transaction support.
     * Client must be released after use to return to connection pool.
     * 
     * @returns A database client with query and release methods
     */
    getClient(): Promise<DatabaseClient>;
    
    /**
     * Close the database connection and release all resources.
     * Should be called during application shutdown.
     */
    close(): Promise<void>;
    
    /**
     * Check if the database connection is healthy.
     * Used for health checks and startup verification.
     * 
     * @returns True if connected, false otherwise
     */
    checkConnection(): Promise<boolean>;
}

/**
 * Database client interface for transaction support.
 * 
 * Clients are acquired from the adapter and must be released after use.
 * Used for executing multiple queries within a single transaction.
 * 
 * @example
 * const client = await adapter.getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('INSERT INTO ...');
 *   await client.query('COMMIT');
 * } finally {
 *   client.release();
 * }
 */
export interface DatabaseClient {
    /**
     * Execute a query within this client's connection/transaction.
     * 
     * @template T - The expected row type
     * @param text - SQL query string
     * @param params - Query parameters
     * @returns Array of result rows
     */
    query<T>(text: string, params?: unknown[]): Promise<T[]>;
    
    /**
     * Release the client back to the connection pool.
     * Must be called after all operations are complete.
     */
    release(): void;
}
