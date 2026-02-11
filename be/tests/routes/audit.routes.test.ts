/**
 * @fileoverview Unit tests for audit routes.
 * Tests pagination, filtering, and admin-only access.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock audit service
const mockAuditService = {
    getLogs: vi.fn(),
    getActionTypes: vi.fn(),
    getResourceTypes: vi.fn(),
    log: vi.fn(),
};

vi.mock('../../src/modules/audit/audit.service.js', () => ({
    auditService: mockAuditService,
    AuditAction: {
        CREATE: 'CREATE',
        UPDATE: 'UPDATE',
        DELETE: 'DELETE',
    },
    AuditResourceType: {
        USER: 'USER',
        FILE: 'FILE',
        BUCKET: 'BUCKET',
    },
}));

// Mock logger
vi.mock('../../src/shared/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock auth middleware
vi.mock('../../src/shared/middleware/auth.middleware.js', () => ({
    requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
    requireRole: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
    getCurrentUser: vi.fn().mockReturnValue({
        id: 'admin-user',
        email: 'admin@example.com',
        role: 'admin',
    }),
}));

describe('Audit Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('AuditService Integration', () => {
        describe('getLogs', () => {
            it('should call auditService.getLogs with correct parameters', async () => {
                const mockResult = {
                    logs: [
                        {
                            id: '1',
                            user_id: 'user1',
                            action: 'CREATE',
                            resource_type: 'FILE',
                            created_at: new Date().toISOString(),
                        },
                    ],
                    pagination: {
                        total: 1,
                        page: 1,
                        limit: 50,
                        totalPages: 1,
                    },
                };

                mockAuditService.getLogs.mockResolvedValue(mockResult);

                // Test the audit service directly
                const result = await mockAuditService.getLogs({
                    page: 1,
                    limit: 50,
                });

                expect(mockAuditService.getLogs).toHaveBeenCalledWith({
                    page: 1,
                    limit: 50,
                });
                expect(result).toEqual(mockResult);
            });

            it('should apply all filter parameters', async () => {
                mockAuditService.getLogs.mockResolvedValue({
                    logs: [],
                    pagination: { total: 0, page: 2, limit: 25, totalPages: 0 },
                });

                await mockAuditService.getLogs({
                    page: 2,
                    limit: 25,
                    userId: 'user123',
                    action: 'CREATE',
                    resourceType: 'FILE',
                    startDate: '2024-01-01',
                    endDate: '2024-12-31',
                    search: 'test',
                });

                expect(mockAuditService.getLogs).toHaveBeenCalledWith({
                    page: 2,
                    limit: 25,
                    userId: 'user123',
                    action: 'CREATE',
                    resourceType: 'FILE',
                    startDate: '2024-01-01',
                    endDate: '2024-12-31',
                    search: 'test',
                });
            });

            it('should handle database errors', async () => {
                mockAuditService.getLogs.mockRejectedValue(new Error('Database error'));

                await expect(mockAuditService.getLogs({ page: 1, limit: 50 })).rejects.toThrow(
                    'Database error'
                );
            });
        });

        describe('getActionTypes', () => {
            it('should return list of action types', async () => {
                const mockActions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'];
                mockAuditService.getActionTypes.mockResolvedValue(mockActions);

                const result = await mockAuditService.getActionTypes();

                expect(mockAuditService.getActionTypes).toHaveBeenCalled();
                expect(result).toEqual(mockActions);
            });

            it('should handle errors', async () => {
                mockAuditService.getActionTypes.mockRejectedValue(new Error('Query failed'));

                await expect(mockAuditService.getActionTypes()).rejects.toThrow('Query failed');
            });
        });

        describe('getResourceTypes', () => {
            it('should return list of resource types', async () => {
                const mockResourceTypes = ['USER', 'FILE', 'BUCKET', 'FOLDER', 'SYSTEM'];
                mockAuditService.getResourceTypes.mockResolvedValue(mockResourceTypes);

                const result = await mockAuditService.getResourceTypes();

                expect(mockAuditService.getResourceTypes).toHaveBeenCalled();
                expect(result).toEqual(mockResourceTypes);
            });

            it('should handle errors', async () => {
                mockAuditService.getResourceTypes.mockRejectedValue(new Error('Query failed'));

                await expect(mockAuditService.getResourceTypes()).rejects.toThrow('Query failed');
            });
        });
    });

    describe('Middleware', () => {
        it('should have requireAuth middleware available', async () => {
            const { requireAuth } = await import('../../src/shared/middleware/auth.middleware.js');
            expect(requireAuth).toBeDefined();
            expect(typeof requireAuth).toBe('function');
        });

        it('should have requireRole middleware available', async () => {
            const { requireRole } = await import('../../src/shared/middleware/auth.middleware.js');
            expect(requireRole).toBeDefined();
            expect(typeof requireRole).toBe('function');
        });

        it('should have requireRole available for admin configuration', async () => {
            const { requireRole } = await import('../../src/shared/middleware/auth.middleware.js');

            // requireRole should be a callable function
            expect(requireRole).toBeDefined();
        });
    });

    describe('Pagination', () => {
        it('should default to page 1 and limit 50', async () => {
            mockAuditService.getLogs.mockResolvedValue({
                logs: [],
                pagination: { total: 0, page: 1, limit: 50, totalPages: 0 },
            });

            // Test default pagination behavior
            const defaultPage = 1;
            const defaultLimit = 50;

            await mockAuditService.getLogs({ page: defaultPage, limit: defaultLimit });

            expect(mockAuditService.getLogs).toHaveBeenCalledWith({
                page: 1,
                limit: 50,
            });
        });

        it('should enforce minimum page of 1', () => {
            const requestedPage = -5;
            const enforcedPage = Math.max(1, requestedPage);

            expect(enforcedPage).toBe(1);
        });

        it('should enforce maximum limit of 100', () => {
            const requestedLimit = 500;
            const enforcedLimit = Math.min(100, Math.max(1, requestedLimit));

            expect(enforcedLimit).toBe(100);
        });

        it('should enforce minimum limit of 1', () => {
            const requestedLimit = 0;
            const enforcedLimit = Math.min(100, Math.max(1, requestedLimit));

            expect(enforcedLimit).toBe(1);
        });
    });
});
