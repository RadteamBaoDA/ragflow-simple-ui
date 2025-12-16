/**
 * @fileoverview Unit tests for external trace service.
 * Tests module structure and basic functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis client
const mockRedisClient = {
    get: vi.fn().mockResolvedValue(null),
    setEx: vi.fn().mockResolvedValue(undefined),
    setNX: vi.fn().mockResolvedValue(true),
    pExpire: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(0),
    isReady: true,
    isOpen: true,
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
};

vi.mock('redis', () => ({
    createClient: vi.fn().mockReturnValue(mockRedisClient),
}));

// Mock Langfuse client
const mockLangfuseTrace = {
    id: 'test-trace-id-12345',
    generation: vi.fn(),
    update: vi.fn(),
    event: vi.fn(),
};

const mockLangfuseClient = {
    trace: vi.fn().mockReturnValue(mockLangfuseTrace),
    flushAsync: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../src/services/langfuse.service.js', () => ({
    getLangfuseClient: vi.fn().mockReturnValue(mockLangfuseClient),
}));

// Mock database
const mockQueryOne = vi.fn();
vi.mock('../../src/db/index.js', () => ({
    query: vi.fn(),
    queryOne: mockQueryOne,
}));

// Mock config
vi.mock('../../src/config/index.js', () => ({
    config: {
        redis: {
            url: 'redis://localhost:6379/0',
        },
        externalChat: {
            enabled: true,
            apiKey: 'test-api-key',
            cacheTtlSeconds: 300,
            lockTimeoutMs: 5000,
        },
    },
}));

// Mock logger
vi.mock('../../src/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('ExternalTraceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRedisClient.get.mockResolvedValue(null);
        mockRedisClient.setNX.mockResolvedValue(true);
        mockQueryOne.mockReset();
    });

    describe('Module exports', () => {
        it('should export ExternalTraceService class', async () => {
            const { ExternalTraceService } = await import('../../src/services/external-trace.service.js');
            expect(ExternalTraceService).toBeDefined();
            expect(typeof ExternalTraceService).toBe('function');
        });

        it('should export externalTraceService singleton', async () => {
            const { externalTraceService } = await import('../../src/services/external-trace.service.js');
            expect(externalTraceService).toBeDefined();
        });
    });

    describe('ExternalTraceService class structure', () => {
        it('should have collectTrace method', async () => {
            const { ExternalTraceService } = await import('../../src/services/external-trace.service.js');
            const service = new ExternalTraceService();
            expect(typeof service.collectTrace).toBe('function');
        });

        it('should have validateEmailWithCache method', async () => {
            const { ExternalTraceService } = await import('../../src/services/external-trace.service.js');
            const service = new ExternalTraceService();
            expect(typeof service.validateEmailWithCache).toBe('function');
        });

        it('should have shutdown method', async () => {
            const { ExternalTraceService } = await import('../../src/services/external-trace.service.js');
            const service = new ExternalTraceService();
            expect(typeof service.shutdown).toBe('function');
        });
    });

    describe('collectTrace basic functionality', () => {
        it('should return proper result structure', async () => {
            const { ExternalTraceService } = await import('../../src/services/external-trace.service.js');
            const service = new ExternalTraceService();

            mockQueryOne.mockResolvedValue(undefined);

            const result = await service.collectTrace({
                email: 'test@example.com',
                message: 'Test message',
                ipAddress: '192.168.1.200'
            });

            expect(result).toHaveProperty('success');
            expect(typeof result.success).toBe('boolean');
        });
    });

    describe('Redis integration', () => {
        it('should use Redis client for caching', async () => {
            const { createClient } = await import('redis');
            const { ExternalTraceService } = await import('../../src/services/external-trace.service.js');

            const service = new ExternalTraceService();
            mockQueryOne.mockResolvedValue(undefined);

            await service.validateEmailWithCache('redis-test@example.com', '10.0.0.200');

            expect(createClient).toHaveBeenCalled();
        });
    });
});
