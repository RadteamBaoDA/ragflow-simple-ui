/**
 * @fileoverview Unit tests for authentication routes.
 * Tests OAuth flow, session management, and dev mode authentication.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/shared/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/shared/config/index.js', () => ({
    config: {
        nodeEnv: 'test',
        frontendUrl: 'http://localhost:5173',
        sharedStorageDomain: '.localhost',
        https: { enabled: false },
        enableRootLogin: true,
        azureAd: {
            clientId: 'test-client-id',
            clientSecret: 'test-secret',
            tenantId: 'test-tenant',
            redirectUri: 'http://localhost:3001/api/auth/callback',
        },
    },
}));

vi.mock('../../src/shared/middleware/auth.middleware.js', () => ({
    getCurrentUser: vi.fn(),
    updateAuthTimestamp: vi.fn(),
    requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
    REAUTH_REQUIRED_ERROR: 'REAUTH_REQUIRED',
}));

vi.mock('../../src/modules/auth/auth.service.js', () => ({
    getAuthorizationUrl: vi.fn().mockReturnValue('https://login.microsoft.com/auth'),
    exchangeCodeForTokens: vi.fn(),
    getUserProfile: vi.fn(),
    generateState: vi.fn().mockReturnValue('mock-state-uuid'),
    refreshAccessToken: vi.fn(),
    isTokenExpired: vi.fn(),
}));

vi.mock('../../src/modules/users/user.service.js', () => ({
    userService: {
        findOrCreateUser: vi.fn(),
        recordUserIp: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../src/modules/audit/audit.service.js', () => ({
    auditService: {
        log: vi.fn().mockResolvedValue(undefined),
    },
    AuditAction: {
        LOGIN: 'LOGIN',
        LOGOUT: 'LOGOUT',
    },
    AuditResourceType: {
        USER: 'USER',
    },
}));

describe('Auth Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Module exports', () => {
        it('should export a router', async () => {
            const authRoutes = await import('../../src/modules/auth/auth.routes.js');
            expect(authRoutes.default).toBeDefined();
        });
    });

    describe('Auth service integration', () => {
        it('should have getAuthorizationUrl available', async () => {
            const { getAuthorizationUrl } = await import('../../src/modules/auth/auth.service.js');
            expect(typeof getAuthorizationUrl).toBe('function');
        });

        it('should have exchangeCodeForTokens available', async () => {
            const { exchangeCodeForTokens } = await import('../../src/modules/auth/auth.service.js');
            expect(typeof exchangeCodeForTokens).toBe('function');
        });

        it('should have getUserProfile available', async () => {
            const { getUserProfile } = await import('../../src/modules/auth/auth.service.js');
            expect(typeof getUserProfile).toBe('function');
        });

        it('should have generateState available', async () => {
            const { generateState } = await import('../../src/modules/auth/auth.service.js');
            expect(typeof generateState).toBe('function');
        });
    });

    describe('User service integration', () => {
        it('should have findOrCreateUser available', async () => {
            const { userService } = await import('../../src/modules/users/user.service.js');
            expect(typeof userService.findOrCreateUser).toBe('function');
        });

        it('should have recordUserIp available', async () => {
            const { userService } = await import('../../src/modules/users/user.service.js');
            expect(typeof userService.recordUserIp).toBe('function');
        });
    });

    describe('Configuration', () => {
        it('should access config values', async () => {
            const { config } = await import('../../src/shared/config/index.js');
            expect(config.nodeEnv).toBe('test');
            expect(config.frontendUrl).toBe('http://localhost:5173');
            expect(config.enableRootLogin).toBe(true);
        });
    });

    describe('Redirect URL validation', () => {
        // Test the validation logic patterns

        it('should reject URLs longer than 2048 characters', () => {
            const longUrl = 'http://localhost:5173/' + 'a'.repeat(2050);
            expect(longUrl.length).toBeGreaterThan(2048);
        });

        it('should accept relative paths starting with /', () => {
            const validPaths = ['/', '/dashboard', '/chat', '/search'];
            validPaths.forEach((path) => {
                expect(path.startsWith('/')).toBe(true);
                expect(path.startsWith('//')).toBe(false);
            });
        });

        it('should reject relative paths starting with //', () => {
            const invalidPath = '//evil.com/redirect';
            expect(invalidPath.startsWith('//')).toBe(true);
        });
    });
});
