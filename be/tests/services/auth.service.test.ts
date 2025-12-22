/**
 * @fileoverview Unit tests for auth service.
 * 
 * Tests OAuth flow functions and token management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'mock-uuid-1234-5678-9012'),
});

// Mock config
vi.mock('../../src/config/index.js', () => ({
  config: {
    azureAd: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
      redirectUri: 'http://localhost:3001/api/auth/callback',
    },
  },
}));

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate correct Azure AD authorization URL', async () => {
      const { getAuthorizationUrl } = await import('../../src/services/auth.service.js');
      const state = 'random-state-123';

      const url = getAuthorizationUrl(state);

      expect(url).toContain('https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=random-state-123');
      expect(url).toContain('scope=');
    });

    it('should include required OAuth scopes', async () => {
      const { getAuthorizationUrl } = await import('../../src/services/auth.service.js');
      
      const url = getAuthorizationUrl('test-state');

      expect(url).toContain('openid');
      expect(url).toContain('profile');
      expect(url).toContain('email');
      expect(url).toContain('User.Read');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens successfully', async () => {
      const mockTokens = {
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid profile email',
        refresh_token: 'mock-refresh-token',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      const { exchangeCodeForTokens } = await import('../../src/services/auth.service.js');
      const result = await exchangeCodeForTokens('auth-code-123');

      expect(result).toEqual(mockTokens);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('oauth2/v2.0/token'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should throw error on failed token exchange', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid code',
      });

      const { exchangeCodeForTokens } = await import('../../src/services/auth.service.js');

      await expect(exchangeCodeForTokens('invalid-code')).rejects.toThrow('Token exchange failed');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      const mockNewTokens = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid profile email',
        refresh_token: 'new-refresh-token',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNewTokens,
      });

      const { refreshAccessToken } = await import('../../src/services/auth.service.js');
      const result = await refreshAccessToken('old-refresh-token');

      expect(result.access_token).toBe('new-access-token');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('refresh_token'),
        })
      );
    });

    it('should throw error on failed refresh', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Token expired',
      });

      const { refreshAccessToken } = await import('../../src/services/auth.service.js');

      await expect(refreshAccessToken('expired-token')).rejects.toThrow('Token refresh failed');
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for undefined expiresAt', async () => {
      const { isTokenExpired } = await import('../../src/services/auth.service.js');

      expect(isTokenExpired(undefined)).toBe(true);
    });

    it('should return true for expired token', async () => {
      const { isTokenExpired } = await import('../../src/services/auth.service.js');
      const expiredTime = Date.now() - 1000; // 1 second ago

      expect(isTokenExpired(expiredTime)).toBe(true);
    });

    it('should return false for valid token', async () => {
      const { isTokenExpired } = await import('../../src/services/auth.service.js');
      const futureTime = Date.now() + 10 * 60 * 1000; // 10 minutes from now

      expect(isTokenExpired(futureTime)).toBe(false);
    });

    it('should consider buffer time', async () => {
      const { isTokenExpired } = await import('../../src/services/auth.service.js');
      const expiresAt = Date.now() + 3 * 60 * 1000; // 3 minutes from now

      // With 5 minute buffer (default), should be considered expired
      expect(isTokenExpired(expiresAt, 300)).toBe(true);

      // With 1 minute buffer, should not be expired
      expect(isTokenExpired(expiresAt, 60)).toBe(false);
    });
  });

  describe('getUserProfile', () => {
    it('should fetch user profile successfully', async () => {
      const mockProfile = {
        id: 'user-123',
        displayName: 'John Doe',
        mail: 'john@example.com',
        department: 'IT',
        jobTitle: 'Developer',
        mobilePhone: '+1234567890',
      };

      // Mock profile fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      });

      // Mock photo fetch (not found)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { getUserProfile } = await import('../../src/services/auth.service.js');
      const result = await getUserProfile('access-token');

      expect(result.id).toBe('user-123');
      expect(result.displayName).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.department).toBe('IT');
      expect(result.avatar).toContain('ui-avatars.com');
    });

    it('should use userPrincipalName when mail is not available', async () => {
      const mockProfile = {
        id: 'user-456',
        displayName: 'Jane Doe',
        mail: null,
        userPrincipalName: 'jane@example.com',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { getUserProfile } = await import('../../src/services/auth.service.js');
      const result = await getUserProfile('access-token');

      expect(result.email).toBe('jane@example.com');
    });

    it('should include base64 avatar when photo is available', async () => {
      const mockProfile = {
        id: 'user-789',
        displayName: 'Bob Smith',
        mail: 'bob@example.com',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      });

      // Mock photo fetch success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Buffer.from('fake-image-data'),
        headers: {
          get: () => 'image/jpeg',
        },
      });

      const { getUserProfile } = await import('../../src/services/auth.service.js');
      const result = await getUserProfile('access-token');

      expect(result.avatar).toContain('data:image/jpeg;base64,');
    });

    it('should throw error on failed profile fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const { getUserProfile } = await import('../../src/services/auth.service.js');

      await expect(getUserProfile('invalid-token')).rejects.toThrow('Failed to fetch user profile');
    });
  });

  describe('generateState', () => {
    it('should export generateState function', async () => {
      const authService = await import('../../src/services/auth.service.js');
      expect(typeof authService.generateState).toBe('function');
    });
  });
});
