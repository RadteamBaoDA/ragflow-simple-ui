/**
 * @fileoverview Comprehensive unit tests for AuthController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Hoisted mocks
const mockAuthService = vi.hoisted(() => ({
  generateState: vi.fn(),
  getAuthorizationUrl: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  getUserProfile: vi.fn(),
  refreshAccessToken: vi.fn(),
  login: vi.fn(),
}));

const mockUserService = vi.hoisted(() => ({
  findOrCreateUser: vi.fn(),
  recordUserIp: vi.fn(),
}));

const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));

const mockGetClientIp = vi.hoisted(() => vi.fn());
const mockUpdateAuthTimestamp = vi.hoisted(() => vi.fn());
const mockGetCurrentUser = vi.hoisted(() => vi.fn());

const mockConfig = {
  enableRootLogin: true,
  azureAd: {
    clientId: 'test-client-id',
    tenantId: 'test-tenant-id',
    redirectUri: 'http://localhost:3001/api/auth/callback',
  },
  frontendUrl: 'http://localhost:5173',
  rootPassword: 'test-root-pass',
};

vi.mock('../../src/services/auth.service.js', () => ({
  authService: mockAuthService,
}));

vi.mock('../../src/services/user.service.js', () => ({
  userService: mockUserService,
}));

vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}));

vi.mock('../../src/utils/ip.js', () => ({
  getClientIp: mockGetClientIp,
}));

vi.mock('../../src/config/index.js', () => ({
  config: mockConfig,
}));

vi.mock('../../src/middleware/auth.middleware.js', () => ({
  updateAuthTimestamp: mockUpdateAuthTimestamp,
  getCurrentUser: mockGetCurrentUser,
}));

describe('AuthController', () => {
  let controller: any;
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const module = await import('../../src/controllers/auth.controller.js');
    controller = new module.AuthController();

    req = {
      query: {},
      body: {},
      session: {} as any,
      ip: '127.0.0.1',
    };

    res = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      redirect: vi.fn(),
    };

    mockGetClientIp.mockReturnValue('127.0.0.1');
  });

  describe('getAuthConfig', () => {
    it('should return auth configuration', async () => {
      await controller.getAuthConfig(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith({
        enableRootLogin: true,
        azureAd: {
          clientId: 'test-client-id',
          tenantId: 'test-tenant-id',
          redirectUri: 'http://localhost:3001/api/auth/callback',
        },
      });
    });

    it('should expose Azure AD configuration', async () => {
      await controller.getAuthConfig(req as Request, res as Response);

      const call = (res.json as any).mock.calls[0][0];
      expect(call.azureAd.clientId).toBe('test-client-id');
      expect(call.azureAd.tenantId).toBe('test-tenant-id');
    });
  });

  describe('getMe', () => {
    it('should return user from session', async () => {
      req.session = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
        },
      } as any;

      mockUserService.recordUserIp.mockResolvedValue(undefined);

      await controller.getMe(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(req.session.user);
      expect(mockUserService.recordUserIp).toHaveBeenCalledWith('user-123', '127.0.0.1');
    });

    it('should return 401 if no session user', async () => {
      req.session = {} as any;

      await controller.getMe(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should handle IP recording errors gracefully', async () => {
      req.session = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      mockUserService.recordUserIp.mockRejectedValue(new Error('IP recording failed'));

      await controller.getMe(req as Request, res as Response);

      expect(mockLog.warn).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(req.session.user);
    });
  });

  describe('loginAzureAd', () => {
    it('should generate state and redirect to Azure AD', async () => {
      const state = 'random-state-123';
      const authUrl = 'https://login.microsoftonline.com/authorize?state=' + state;

      mockAuthService.generateState.mockReturnValue(state);
      mockAuthService.getAuthorizationUrl.mockReturnValue(authUrl);

      req.session = {} as any;

      await controller.loginAzureAd(req as Request, res as Response);

      expect(mockAuthService.generateState).toHaveBeenCalled();
      expect(mockAuthService.getAuthorizationUrl).toHaveBeenCalledWith(state);
      expect(req.session.oauthState).toBe(state);
      expect(res.redirect).toHaveBeenCalledWith(authUrl);
    });
  });

  describe('handleCallback', () => {
    beforeEach(() => {
      req.query = { code: 'auth-code-123', state: 'state-123' };
      req.session = { oauthState: 'state-123', save: vi.fn((cb) => cb()) } as any;
    });

    it('should redirect on Azure AD error', async () => {
      req.query = { error: 'access_denied' };

      await controller.handleCallback(req as Request, res as Response);

      expect(mockLog.error).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/login?error=auth_failed'
      );
    });

    it('should redirect if code is missing', async () => {
      req.query = { state: 'state-123' };

      await controller.handleCallback(req as Request, res as Response);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/login?error=no_code'
      );
    });

    it('should redirect if state does not match', async () => {
      req.session = { oauthState: 'different-state' } as any;

      await controller.handleCallback(req as Request, res as Response);

      expect(mockLog.warn).toHaveBeenCalledWith('State mismatch in OAuth callback');
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/login?error=invalid_state'
      );
    });

    it('should complete OAuth flow successfully', async () => {
      const tokens = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600,
      };

      const adUser = {
        mail: 'user@example.com',
        displayName: 'Test User',
        id: 'ad-user-id',
      };

      const dbUser = {
        id: 'db-user-123',
        email: 'user@example.com',
        name: 'Test User',
        role: 'user',
        display_name: 'Test User',
        permissions: '["read"]',
      };

      mockAuthService.exchangeCodeForTokens.mockResolvedValue(tokens);
      mockAuthService.getUserProfile.mockResolvedValue(adUser);
      mockUserService.findOrCreateUser.mockResolvedValue(dbUser);

      await controller.handleCallback(req as Request, res as Response);

      expect(mockAuthService.exchangeCodeForTokens).toHaveBeenCalledWith('auth-code-123');
      expect(mockAuthService.getUserProfile).toHaveBeenCalledWith('access-token-123');
      expect(mockUserService.findOrCreateUser).toHaveBeenCalledWith(adUser, '127.0.0.1');
      expect(mockUpdateAuthTimestamp).toHaveBeenCalled();
      expect(req.session.save).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173');
    });

    it('should handle session save errors', async () => {
      const tokens = { access_token: 'token', refresh_token: 'refresh', expires_in: 3600 };
      const adUser = { mail: 'user@test.com', displayName: 'User', id: 'id' };
      const dbUser = {
        id: 'user-1',
        email: 'user@test.com',
        name: 'User',
        role: 'user',
        display_name: 'User',
        permissions: '[]',
      };

      mockAuthService.exchangeCodeForTokens.mockResolvedValue(tokens);
      mockAuthService.getUserProfile.mockResolvedValue(adUser);
      mockUserService.findOrCreateUser.mockResolvedValue(dbUser);

      req.session = {
        oauthState: 'state-123',
        save: vi.fn((cb) => cb(new Error('Save failed'))),
      } as any;

      await controller.handleCallback(req as Request, res as Response);

      expect(mockLog.error).toHaveBeenCalledWith(
        'Session save failed in OAuth callback',
        expect.any(Object)
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/login?error=session_error'
      );
    });

    it('should handle authentication errors', async () => {
      mockAuthService.exchangeCodeForTokens.mockRejectedValue(
        new Error('Token exchange failed')
      );

      await controller.handleCallback(req as Request, res as Response);

      expect(mockLog.error).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/login?error=auth_failed'
      );
    });
  });

  describe('logout', () => {
    it('should destroy session and return success', async () => {
      req.session = {
        destroy: vi.fn((cb) => cb(null)),
      } as any;

      await controller.logout(req as Request, res as Response);

      expect(req.session.destroy).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    });

    it('should handle logout errors', async () => {
      req.session = {
        destroy: vi.fn((cb) => cb(new Error('Destroy failed'))),
      } as any;

      await controller.logout(req as Request, res as Response);

      expect(mockLog.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Logout failed' });
    });
  });

  describe('reauth', () => {
    it('should return 401 if not authenticated', async () => {
      mockGetCurrentUser.mockReturnValue(null);

      await controller.reauth(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    });

    it('should validate root password', async () => {
      mockGetCurrentUser.mockReturnValue({ id: 'root-user' });
      req.body = { password: 'test-root-pass' };

      await controller.reauth(req as Request, res as Response);

      expect(mockUpdateAuthTimestamp).toHaveBeenCalledWith(req, true);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should reject invalid root password', async () => {
      mockGetCurrentUser.mockReturnValue({ id: 'root-user' });
      req.body = { password: 'wrong-password' };

      await controller.reauth(req as Request, res as Response);

      expect(mockLog.warn).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid password' });
    });
  });

  describe('refreshToken', () => {
    it('should return 401 if not authenticated', async () => {
      mockGetCurrentUser.mockReturnValue(null);

      await controller.refreshToken(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    });

    it('should skip refresh for root user', async () => {
      mockGetCurrentUser.mockReturnValue({ id: 'root-user' });

      await controller.refreshToken(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Root user does not use tokens',
      });
    });

    it('should return error if no refresh token', async () => {
      mockGetCurrentUser.mockReturnValue({ id: 'user-123' });
      req.session = {} as any;

      await controller.refreshToken(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'NO_REFRESH_TOKEN' });
    });

    it('should refresh access token successfully', async () => {
      mockGetCurrentUser.mockReturnValue({ id: 'user-123' });
      req.session = {
        refreshToken: 'refresh-token-456',
        save: vi.fn((cb) => cb()),
      } as any;

      const newTokens = {
        access_token: 'new-access-token',
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
      };

      mockAuthService.refreshAccessToken.mockResolvedValue(newTokens);

      await controller.refreshToken(req as Request, res as Response);

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith('refresh-token-456');
      expect(req.session.accessToken).toBe('new-access-token');
      expect(req.session.refreshToken).toBe('new-refresh-token');
      expect(res.json).toHaveBeenCalledWith({ success: true, expiresIn: 3600 });
    });

    it('should handle token refresh failure', async () => {
      mockGetCurrentUser.mockReturnValue({ id: 'user-123' });
      req.session = { refreshToken: 'invalid-token' } as any;

      mockAuthService.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'));

      await controller.refreshToken(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_REFRESH_FAILED' });
    });
  });

  describe('getTokenStatus', () => {
    it('should return token status', async () => {
      mockGetCurrentUser.mockReturnValue({ id: 'user-123' });
      req.session = { accessToken: 'token-123' } as any;

      await controller.getTokenStatus(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith({ hasToken: true });
    });

    it('should return false if no token', async () => {
      mockGetCurrentUser.mockReturnValue({ id: 'user-123' });
      req.session = {} as any;

      await controller.getTokenStatus(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith({ hasToken: false });
    });
  });

  describe('loginRoot', () => {
    it('should authenticate root user successfully', async () => {
      req.body = { username: 'root', password: 'root-pass' };
      req.session = { save: vi.fn((cb) => cb()) } as any;

      const loginResult = {
        user: {
          id: 'root-user',
          email: 'root@system',
          displayName: 'Root User',
          role: 'admin',
          permissions: ['*'],
        },
      };

      mockAuthService.login.mockResolvedValue(loginResult);

      await controller.loginRoot(req as Request, res as Response);

      expect(mockAuthService.login).toHaveBeenCalledWith('root', 'root-pass', '127.0.0.1');
      expect(mockUpdateAuthTimestamp).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(loginResult);
    });

    it('should return 401 for invalid credentials', async () => {
      req.body = { username: 'root', password: 'wrong-pass' };

      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      await controller.loginRoot(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });
  });

  describe('Alias methods', () => {
    it('should have login alias to loginRoot', async () => {
      expect(controller.login).toBeDefined();
      expect(typeof controller.login).toBe('function');
    });

    it('should have callback alias to handleCallback', async () => {
      expect(controller.callback).toBeDefined();
      expect(typeof controller.callback).toBe('function');
    });
  });
});
