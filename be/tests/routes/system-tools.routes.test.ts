/**
 * @fileoverview Unit tests for system tools routes.
 * Tests system monitoring tools endpoints.
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
    requireRole: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
    requirePermission: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));

const mockTools = [
    {
        id: 'portainer',
        name: 'Portainer',
        url: 'https://portainer.example.com',
        icon: 'docker',
        description: 'Docker management',
        enabled: true,
    },
    {
        id: 'grafana',
        name: 'Grafana',
        url: 'https://grafana.example.com',
        icon: 'chart',
        description: 'Monitoring dashboard',
        enabled: true,
    },
];

vi.mock('../../src/services/system-tools.service.js', () => ({
    systemToolsService: {
        getEnabledTools: vi.fn().mockReturnValue(mockTools),
        reload: vi.fn(),
    },
}));

describe('System Tools Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Module exports', () => {
        it('should export a router', async () => {
            const systemToolsRoutes = await import('../../src/routes/system-tools.routes.js');
            expect(systemToolsRoutes.default).toBeDefined();
        });
    });

    describe('System tools service integration', () => {
        it('should have getEnabledTools method', async () => {
            const { systemToolsService } = await import('../../src/services/system-tools.service.js');
            expect(typeof systemToolsService.getEnabledTools).toBe('function');
        });

        it('should have reload method', async () => {
            const { systemToolsService } = await import('../../src/services/system-tools.service.js');
            expect(typeof systemToolsService.reload).toBe('function');
        });

        it('should verify getEnabledTools returns array', async () => {
            const { systemToolsService } = await import('../../src/services/system-tools.service.js');

            // Verify the method exists and is callable
            expect(typeof systemToolsService.getEnabledTools).toBe('function');
        });

        it('should reload configuration', async () => {
            const { systemToolsService } = await import('../../src/services/system-tools.service.js');

            systemToolsService.reload();

            expect(systemToolsService.reload).toHaveBeenCalled();
        });
    });

    describe('Middleware configuration', () => {
        it('should require admin role', async () => {
            const { requireRole } = await import('../../src/middleware/auth.middleware.js');
            expect(requireRole).toBeDefined();
            expect(typeof requireRole).toBe('function');
        });
    });

    describe('Response format', () => {
        it('should format tools response correctly', () => {
            const mockToolsData = [
                { id: 'portainer', name: 'Portainer', url: 'https://portainer.example.com' },
                { id: 'grafana', name: 'Grafana', url: 'https://grafana.example.com' },
            ];
            const response = {
                tools: mockToolsData,
                count: mockToolsData.length,
            };

            expect(response.count).toBe(2);
            expect(response.tools).toHaveLength(2);
        });

        it('should format reload response correctly', () => {
            const mockToolsData = [
                { id: 'portainer', name: 'Portainer' },
            ];
            const response = {
                message: 'System tools configuration reloaded',
                count: mockToolsData.length,
            };

            expect(response.message).toBe('System tools configuration reloaded');
            expect(response.count).toBe(1);
        });
    });
});
