/**
 * @fileoverview Comprehensive unit tests for database abstraction layer.
 * Tests adapter initialization, query execution, connection pooling, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
const mockLog = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
};

vi.mock('../../src/services/logger.service.js', () => ({
    log: mockLog,
}));

// Mock config 
vi.mock('../../src/config/index.js', () => ({
    config: {
        database: {
            host: 'localhost',
            port: 5432,
            name: 'test_db',
            user: 'test_user',
            password: 'test_pass',
        },
    },
}));

// Mock PostgreSQL adapter
const mockAdapter = {
    query: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue(undefined),
    getClient: vi.fn().mockResolvedValue({
        query: vi.fn(),
        release: vi.fn(),
    }),
    checkConnection: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(undefined),
};

const MockPostgreSQLAdapter = vi.fn().mockImplementation(() => mockAdapter);

vi.mock('../../src/db/adapters/postgresql.js', () => ({
    PostgreSQLAdapter: MockPostgreSQLAdapter,
}));

describe.skip('Database Module', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset module to clear singleton adapter
        vi.resetModules();
        mockAdapter.checkConnection.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Module exports', () => {
        it('should export query function', async () => {
            const db = await import('../../src/db/index.js');
            expect(typeof db.query).toBe('function');
        });

        it('should export queryOne function', async () => {
            const db = await import('../../src/db/index.js');
            expect(typeof db.queryOne).toBe('function');
        });

        it('should export getAdapter function', async () => {
            const db = await import('../../src/db/index.js');
            expect(typeof db.getAdapter).toBe('function');
        });

        it('should export getClient function', async () => {
            const db = await import('../../src/db/index.js');
            expect(typeof db.getClient).toBe('function');
        });

        it('should export closePool function', async () => {
            const db = await import('../../src/db/index.js');
            expect(typeof db.closePool).toBe('function');
        });

        it('should export checkConnection function', async () => {
            const db = await import('../../src/db/index.js');
            expect(typeof db.checkConnection).toBe('function');
        });

        it('should export db convenience object', async () => {
            const { db } = await import('../../src/db/index.js');
            expect(db).toBeDefined();
            expect(typeof db.query).toBe('function');
            expect(typeof db.queryOne).toBe('function');
            expect(typeof db.getClient).toBe('function');
        });

        it('should export deprecated getPool function', async () => {
            const db = await import('../../src/db/index.js');
            expect(typeof db.getPool).toBe('function');
        });
    });

    describe('getAdapter', () => {
        it('should initialize adapter on first call', async () => {
            const { getAdapter } = await import('../../src/db/index.js');
            
            const adapter = await getAdapter();

            expect(MockPostgreSQLAdapter).toHaveBeenCalledWith({
                host: 'localhost',
                port: 5432,
                database: 'test_db',
                user: 'test_user',
                password: 'test_pass',
            });
            expect(mockAdapter.checkConnection).toHaveBeenCalled();
            expect(mockLog.info).toHaveBeenCalledWith(
                'Database: PostgreSQL',
                expect.objectContaining({
                    host: 'localhost',
                    database: 'test_db',
                })
            );
            expect(adapter).toBe(mockAdapter);
        });

        it('should return same adapter on subsequent calls (singleton)', async () => {
            const { getAdapter } = await import('../../src/db/index.js');
            
            const adapter1 = await getAdapter();
            const adapter2 = await getAdapter();

            expect(adapter1).toBe(adapter2);
            expect(MockPostgreSQLAdapter).toHaveBeenCalledTimes(1);
        });

        it('should throw error when connection check fails', async () => {
            vi.resetModules();
            mockAdapter.checkConnection.mockResolvedValueOnce(false);

            const { getAdapter } = await import('../../src/db/index.js');

            await expect(getAdapter()).rejects.toThrow('PostgreSQL connection check failed');
        });
    });

    describe('query', () => {
        it('should execute query with parameters', async () => {
            const { query } = await import('../../src/db/index.js');
            const expectedResults = [
                { id: 1, name: 'John' },
                { id: 2, name: 'Jane' },
            ];
            mockAdapter.query.mockResolvedValueOnce(expectedResults);

            const results = await query('SELECT * FROM users WHERE age > $1', [25]);

            expect(mockAdapter.query).toHaveBeenCalledWith(
                'SELECT * FROM users WHERE age > $1',
                [25]
            );
            expect(results).toEqual(expectedResults);
        });

        it('should execute query without parameters', async () => {
            const { query } = await import('../../src/db/index.js');
            mockAdapter.query.mockResolvedValueOnce([]);

            const results = await query('SELECT * FROM users');

            expect(mockAdapter.query).toHaveBeenCalledWith('SELECT * FROM users', undefined);
            expect(results).toEqual([]);
        });
    });

    describe('queryOne', () => {
        it('should return first row when found', async () => {
            const { queryOne } = await import('../../src/db/index.js');
            const expectedUser = { id: 1, name: 'John', email: 'john@example.com' };
            mockAdapter.queryOne.mockResolvedValueOnce(expectedUser);

            const user = await queryOne('SELECT * FROM users WHERE id = $1', [1]);

            expect(mockAdapter.queryOne).toHaveBeenCalledWith(
                'SELECT * FROM users WHERE id = $1',
                [1]
            );
            expect(user).toEqual(expectedUser);
        });

        it('should return undefined when no row found', async () => {
            const { queryOne } = await import('../../src/db/index.js');
            mockAdapter.queryOne.mockResolvedValueOnce(undefined);

            const user = await queryOne('SELECT * FROM users WHERE id = $1', [999]);

            expect(user).toBeUndefined();
        });
    });

    describe('getClient', () => {
        it('should return database client for transactions', async () => {
            const { getClient } = await import('../../src/db/index.js');
            const mockClient = {
                query: vi.fn(),
                release: vi.fn(),
            };
            mockAdapter.getClient.mockResolvedValueOnce(mockClient);

            const client = await getClient();

            expect(mockAdapter.getClient).toHaveBeenCalled();
            expect(client).toEqual(mockClient);
            expect(typeof client.query).toBe('function');
            expect(typeof client.release).toBe('function');
        });
    });

    describe('closePool', () => {
        it('should close adapter connection', async () => {
            const { getAdapter, closePool } = await import('../../src/db/index.js');
            
            // Initialize adapter first
            await getAdapter();

            await closePool();

            expect(mockAdapter.close).toHaveBeenCalled();
        });

        it('should handle closePool when adapter not initialized', async () => {
            const { closePool } = await import('../../src/db/index.js');

            await expect(closePool()).resolves.toBeUndefined();
            expect(mockAdapter.close).not.toHaveBeenCalled();
        });

        it('should reset adapter to null after closing', async () => {
            const { getAdapter, closePool } = await import('../../src/db/index.js');
            
            // Initialize adapter
            await getAdapter();
            expect(MockPostgreSQLAdapter).toHaveBeenCalledTimes(1);

            // Close pool
            await closePool();

            // Next call should re-initialize
            await getAdapter();
            expect(MockPostgreSQLAdapter).toHaveBeenCalledTimes(2);
        });
    });

    describe('checkConnection', () => {
        it('should return true when connected', async () => {
            const { checkConnection } = await import('../../src/db/index.js');
            mockAdapter.checkConnection.mockResolvedValueOnce(true);

            const isConnected = await checkConnection();

            expect(isConnected).toBe(true);
            expect(mockAdapter.checkConnection).toHaveBeenCalled();
        });

        it('should return false on connection error', async () => {
            vi.resetModules();
            mockAdapter.checkConnection.mockRejectedValueOnce(new Error('Connection refused'));

            const { checkConnection } = await import('../../src/db/index.js');

            const isConnected = await checkConnection();

            expect(isConnected).toBe(false);
            expect(mockLog.error).toHaveBeenCalledWith(
                'Database connection check failed',
                expect.objectContaining({
                    error: 'Connection refused',
                })
            );
        });
    });

    describe('getPool (deprecated)', () => {
        it('should return null and log deprecation warning', async () => {
            const { getPool } = await import('../../src/db/index.js');

            const pool = getPool();

            expect(pool).toBeNull();
            expect(mockLog.warn).toHaveBeenCalledWith(
                'getPool() is deprecated, database now uses adapter pattern'
            );
        });
    });

    describe('db convenience object', () => {
        it('should provide convenient query methods', async () => {
            const { db } = await import('../../src/db/index.js');
            mockAdapter.query.mockResolvedValueOnce([{ id: 1 }]);

            const results = await db.query('SELECT * FROM test');

            expect(results).toEqual([{ id: 1 }]);
        });

        it('should provide convenient queryOne method', async () => {
            const { db } = await import('../../src/db/index.js');
            mockAdapter.queryOne.mockResolvedValueOnce({ id: 1 });

            const result = await db.queryOne('SELECT * FROM test WHERE id = $1', [1]);

            expect(result).toEqual({ id: 1 });
        });

        it('should provide convenient getClient method', async () => {
            const { db } = await import('../../src/db/index.js');
            const mockClient = { query: vi.fn(), release: vi.fn() };
            mockAdapter.getClient.mockResolvedValueOnce(mockClient);

            const client = await db.getClient();

            expect(client).toEqual(mockClient);
        });
    });
});
