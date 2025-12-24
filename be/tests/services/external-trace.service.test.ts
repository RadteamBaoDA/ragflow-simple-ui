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
    score: vi.fn(),
    flushAsync: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/models/external/langfuse.js', () => ({
    langfuseClient: mockLangfuseClient,
}));

// Mock database (still needed for imports but not logic if we spy on method)
vi.mock('@/models/factory.js', () => ({
    ModelFactory: {
        user: {
            findByEmail: vi.fn()
        }
    }
}));

// Mock config
vi.mock('@/config/index.js', () => ({
    config: {
        redis: {
            url: 'redis://localhost:6379/0',
        },
        externalTrace: {
            enabled: true,
            apiKey: 'test-api-key',
            cacheTtlSeconds: 300,
            lockTimeoutMs: 5000,
        },
        langfuse: {
            secretKey: 'sk-lf-test',
            publicKey: 'pk-lf-test',
            baseUrl: 'http://localhost:3000',
        }
    },
}));

// Mock logger
vi.mock('@/services/logger.service.js', () => ({
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
        it('should have processTrace method', async () => {
            const { ExternalTraceService } = await import('../../src/services/external-trace.service.js');
            const service = new ExternalTraceService();
            expect(typeof service.processTrace).toBe('function');
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

    describe('processFeedback functionality', () => {
        it('should process feedback with traceId, value, and comment', async () => {
            const { externalTraceService } = await import('../../src/services/external-trace.service.js');

            const feedbackParams = {
                traceId: 'trace-123',
                value: 1,
                comment: 'Great!'
            };

            const result = await externalTraceService.processFeedback(feedbackParams);

            expect(result.success).toBe(true);
            expect(mockLangfuseClient.score).toHaveBeenCalledWith({
                traceId: 'trace-123',
                name: 'user-feedback',
                value: 1,
                comment: 'Great!'
            });
            expect(mockLangfuseClient.flushAsync).toHaveBeenCalled();
        });

        it('should fallback to messageId if traceId is missing', async () => {
            const { externalTraceService } = await import('../../src/services/external-trace.service.js');

            const feedbackParams = {
                messageId: 'msg-123',
                value: 0,
                comment: 'Bad'
            };

            const result = await externalTraceService.processFeedback(feedbackParams);

            expect(result.success).toBe(true);
            expect(mockLangfuseClient.score).toHaveBeenCalledWith({
                traceId: 'msg-123',
                name: 'user-feedback',
                value: 0,
                comment: 'Bad'
            });
        });

        it('should throw error if no traceId/messageId provided', async () => {
            const { externalTraceService } = await import('../../src/services/external-trace.service.js');

            await expect(externalTraceService.processFeedback({ value: 1 }))
                .rejects.toThrow('Trace ID required');
        });
    });

    describe('Redis integration', () => {
        it('should use Redis client for caching', async () => {
            const { createClient } = await import('redis');
            const { ExternalTraceService } = await import('../../src/services/external-trace.service.js');

            const service = new ExternalTraceService();

            await service.validateEmailWithCache('redis-test@example.com', '10.0.0.200');

            expect(createClient).toHaveBeenCalled();
        });
    });
});
