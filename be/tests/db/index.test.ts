/**
 * @fileoverview Unit tests for database abstraction layer.
 * Tests module structure and export patterns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../../src/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
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
vi.mock('../../src/db/adapters/postgresql.js', () => ({
    PostgreSQLAdapter: vi.fn().mockImplementation(() => ({
        query: vi.fn().mockResolvedValue([]),
        queryOne: vi.fn().mockResolvedValue(undefined),
        getClient: vi.fn().mockResolvedValue({}),
        checkConnection: vi.fn().mockResolvedValue(true),
        close: vi.fn().mockResolvedValue(undefined),
    })),
}));

describe('Database Module', () => {
    beforeEach(() => {
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
    });

});
