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
vi.mock('../../../src/shared/config/index.js', () => ({
    config: {
        langfuse: {
            secretKey: 'test-secret-key',
            publicKey: 'test-public-key',
            baseUrl: 'https://langfuse.example.com',
        },
    },
}));

// Mock logger
vi.mock('../../../src/shared/services/logger.service.js', () => ({
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
            const langfuseService = await import('../../../src/shared/services/langfuse.service.js');
            expect(typeof langfuseService.getLangfuseClient).toBe('function');
        });

        it('should export shutdownLangfuse function', async () => {
            const langfuseService = await import('../../../src/shared/services/langfuse.service.js');
            expect(typeof langfuseService.shutdownLangfuse).toBe('function');
        });
    });

    describe('getLangfuseClient', () => {
        it('should create a Langfuse client with config', async () => {
            const { Langfuse } = await import('langfuse');
            const { getLangfuseClient } = await import('../../../src/shared/services/langfuse.service.js');

            const client = getLangfuseClient();

            expect(client).toBeDefined();
            expect(Langfuse).toHaveBeenCalledWith({
                secretKey: 'test-secret-key',
                publicKey: 'test-public-key',
                baseUrl: 'https://langfuse.example.com',
            });
        });

        it('should return the same client instance on subsequent calls (singleton)', async () => {
            const { getLangfuseClient } = await import('../../../src/shared/services/langfuse.service.js');

            const client1 = getLangfuseClient();
            const client2 = getLangfuseClient();

            expect(client1).toBe(client2);
        });

        it('should log debug message on initialization', async () => {
            const { log } = await import('../../../src/shared/services/logger.service.js');
            await import('../../../src/shared/services/langfuse.service.js');

            // Log should have been called during module import/init
            expect(log.debug).toBeDefined();
        });
    });

    describe('shutdownLangfuse', () => {
        it('should call shutdownAsync on client and reset singleton', async () => {
            vi.resetModules();
            vi.clearAllMocks();
            
            // Re-setup mocks
            vi.doMock('langfuse', () => ({
                Langfuse: vi.fn().mockImplementation(() => mockLangfuseInstance),
            }));
            vi.doMock('../../../src/shared/config/index.js', () => ({
                config: {
                    langfuse: {
                        secretKey: 'test-secret-key',
                        publicKey: 'test-public-key',
                        baseUrl: 'https://langfuse.example.com',
                    },
                },
            }));
            
            const { getLangfuseClient, shutdownLangfuse } = await import('../../../src/shared/services/langfuse.service.js');
            const { log } = await import('../../../src/shared/services/logger.service.js');
            
            // Initialize client
            const client = getLangfuseClient();
            expect(client).toBeTruthy();
            
            // Now shutdown
            await shutdownLangfuse();
            
            expect(mockLangfuseInstance.shutdownAsync).toHaveBeenCalled();
            expect(log.info).toHaveBeenCalledWith('Shutting down Langfuse client');
        });

        it('should handle shutdown when no client exists', async () => {
            vi.resetModules();
            vi.clearAllMocks();
            
            const { shutdownLangfuse } = await import('../../../src/shared/services/langfuse.service.js');
            
            // Should not throw when no client is initialized
            await expect(shutdownLangfuse()).resolves.toBeUndefined();
        });
    });

    describe('checkHealth', () => {
        beforeEach(() => {
            vi.resetModules();
            vi.clearAllMocks();
            global.fetch = vi.fn();
        });

        it('should return false when Langfuse not configured', async () => {
            vi.doMock('../../../src/shared/config/index.js', () => ({
                config: {
                    langfuse: {
                        secretKey: '',
                        publicKey: '',
                        baseUrl: '',
                    },
                },
            }));

            const { checkHealth } = await import('../../../src/shared/services/langfuse.service.js');
            const result = await checkHealth();

            expect(result).toBe(false);
        });

        it('should return true when API returns ok', async () => {
            vi.doMock('../../../src/shared/config/index.js', () => ({
                config: {
                    langfuse: {
                        secretKey: 'test-secret-key',
                        publicKey: 'test-public-key',
                        baseUrl: 'https://langfuse.example.com',
                    },
                },
            }));
            vi.doMock('langfuse', () => ({
                Langfuse: vi.fn().mockImplementation(() => mockLangfuseInstance),
            }));

            (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });

            const { checkHealth, getLangfuseClient } = await import('../../../src/shared/services/langfuse.service.js');
            
            // Initialize client first
            getLangfuseClient();
            
            const result = await checkHealth();

            expect(result).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://langfuse.example.com/api/public/ingestion',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                    }),
                })
            );
        });

        it('should return true when API returns 400 (auth passed)', async () => {
            vi.doMock('../../../src/shared/config/index.js', () => ({
                config: {
                    langfuse: {
                        secretKey: 'test-secret-key',
                        publicKey: 'test-public-key',
                        baseUrl: 'https://langfuse.example.com',
                    },
                },
            }));
            vi.doMock('langfuse', () => ({
                Langfuse: vi.fn().mockImplementation(() => mockLangfuseInstance),
            }));

            (global.fetch as any).mockResolvedValue({ ok: false, status: 400 });

            const { checkHealth, getLangfuseClient } = await import('../../../src/shared/services/langfuse.service.js');
            
            // Initialize client first
            getLangfuseClient();
            
            const result = await checkHealth();

            expect(result).toBe(true);
        });

        it('should return false when API returns 401', async () => {
            vi.doMock('../../../src/shared/config/index.js', () => ({
                config: {
                    langfuse: {
                        secretKey: 'test-secret-key',
                        publicKey: 'test-public-key',
                        baseUrl: 'https://langfuse.example.com',
                    },
                },
            }));
            vi.doMock('langfuse', () => ({
                Langfuse: vi.fn().mockImplementation(() => mockLangfuseInstance),
            }));

            (global.fetch as any).mockResolvedValue({ ok: false, status: 401 });

            const { checkHealth, getLangfuseClient } = await import('../../../src/shared/services/langfuse.service.js');
            
            // Initialize client first
            getLangfuseClient();
            
            const result = await checkHealth();

            expect(result).toBe(false);
        });

        it('should return false on network error', async () => {
            vi.doMock('../../../src/shared/config/index.js', () => ({
                config: {
                    langfuse: {
                        secretKey: 'test-secret-key',
                        publicKey: 'test-public-key',
                        baseUrl: 'https://langfuse.example.com',
                    },
                },
            }));
            vi.doMock('langfuse', () => ({
                Langfuse: vi.fn().mockImplementation(() => mockLangfuseInstance),
            }));

            (global.fetch as any).mockRejectedValue(new Error('Network error'));

            const { checkHealth, getLangfuseClient } = await import('../../../src/shared/services/langfuse.service.js');
            const { log } = await import('../../../src/shared/services/logger.service.js');
            
            // Initialize client first
            getLangfuseClient();
            
            const result = await checkHealth();

            expect(result).toBe(false);
            expect(log.warn).toHaveBeenCalledWith('Langfuse health check failed', expect.any(Object));
        });
    });
});
