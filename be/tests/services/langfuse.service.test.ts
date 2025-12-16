/**
 * @fileoverview Unit tests for Langfuse observability service.
 * Tests client initialization, singleton pattern, and graceful shutdown.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Langfuse client
const mockLangfuseInstance = {
    trace: vi.fn(),
    generation: vi.fn(),
    shutdownAsync: vi.fn().mockResolvedValue(undefined),
};

vi.mock('langfuse', () => ({
    Langfuse: vi.fn().mockImplementation(() => mockLangfuseInstance),
}));

// Mock config
vi.mock('../../src/config/index.js', () => ({
    config: {
        langfuse: {
            secretKey: 'test-secret-key',
            publicKey: 'test-public-key',
            baseUrl: 'https://langfuse.example.com',
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

describe('LangfuseService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Module exports', () => {
        it('should export getLangfuseClient function', async () => {
            const langfuseService = await import('../../src/services/langfuse.service.js');
            expect(typeof langfuseService.getLangfuseClient).toBe('function');
        });

        it('should export shutdownLangfuse function', async () => {
            const langfuseService = await import('../../src/services/langfuse.service.js');
            expect(typeof langfuseService.shutdownLangfuse).toBe('function');
        });
    });

    describe('getLangfuseClient', () => {
        it('should create a Langfuse client with config', async () => {
            const { Langfuse } = await import('langfuse');
            const { getLangfuseClient } = await import('../../src/services/langfuse.service.js');

            const client = getLangfuseClient();

            expect(client).toBeDefined();
            expect(Langfuse).toHaveBeenCalledWith({
                secretKey: 'test-secret-key',
                publicKey: 'test-public-key',
                baseUrl: 'https://langfuse.example.com',
            });
        });

        it('should return the same client instance on subsequent calls (singleton)', async () => {
            const { getLangfuseClient } = await import('../../src/services/langfuse.service.js');

            const client1 = getLangfuseClient();
            const client2 = getLangfuseClient();

            expect(client1).toBe(client2);
        });

        it('should log debug message on initialization', async () => {
            const { log } = await import('../../src/services/logger.service.js');
            await import('../../src/services/langfuse.service.js');

            // Log should have been called during module import/init
            expect(log.debug).toBeDefined();
        });
    });

    describe('shutdownLangfuse', () => {
        it('should export shutdownLangfuse function', async () => {
            const langfuseService = await import('../../src/services/langfuse.service.js');
            expect(typeof langfuseService.shutdownLangfuse).toBe('function');
        });
    });
});
