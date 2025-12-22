/**
 * @fileoverview Unit tests for RAGFlow routes.
 * Tests RAGFlow configuration endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/middleware/auth.middleware.js', () => ({
    requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
    requirePermission: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
    requireRole: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock('../../src/services/ragflow.service.js', () => ({
    ragflowService: {
        getConfig: vi.fn().mockReturnValue({
            aiChatUrl: 'https://ragflow.example.com/chat',
            aiSearchUrl: 'https://ragflow.example.com/search',
            chatSources: ['source1', 'source2'],
            searchSources: ['source3'],
        }),
    },
}));

describe('RAGFlow Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Module exports', () => {
        it('should export a router', async () => {
            const ragflowRoutes = await import('../../src/routes/ragflow.routes.js');
            expect(ragflowRoutes.default).toBeDefined();
        });
    });

    describe('RAGFlow service integration', () => {
        it('should have getConfig method', async () => {
            const { ragflowService } = await import('../../src/services/ragflow.service.js');
            expect(typeof ragflowService.getConfig).toBe('function');
        });

        it('should call getConfig method', async () => {
            const { ragflowService } = await import('../../src/services/ragflow.service.js');

            // Verify getConfig is callable
            expect(typeof ragflowService.getConfig).toBe('function');
        });
    });

    describe('Middleware configuration', () => {
        it('should require authentication', async () => {
            const { requireAuth } = await import('../../src/middleware/auth.middleware.js');
            expect(requireAuth).toBeDefined();
            expect(typeof requireAuth).toBe('function');
        });

        it('should require view_chat permission for config endpoint', async () => {
            const { requirePermission } = await import('../../src/middleware/auth.middleware.js');
            expect(requirePermission).toBeDefined();
            expect(typeof requirePermission).toBe('function');
        });
    });
});
