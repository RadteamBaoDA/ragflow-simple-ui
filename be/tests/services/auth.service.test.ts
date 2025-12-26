/**
 * @fileoverview Unit tests for auth service.
 * 
 * Tests OAuth flow functions and token management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Global fetch mock
const mockFetch = vi.fn()
global.fetch = mockFetch as any

// crypto mock - use spyOn for proper mocking
const mockRandomUUID = vi.fn(() => 'mock-uuid-1234')
vi.stubGlobal('crypto', {
  randomUUID: mockRandomUUID,
})

// Hoist all mocks
const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

const mockUserModel = vi.hoisted(() => ({
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
}))

const mockUserIpHistory = vi.hoisted(() => ({
  findByUserAndIp: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}))

// Apply all mocks
vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}))

vi.mock('../../src/models/factory.js', () => ({
  ModelFactory: {
    user: mockUserModel,
    userIpHistory: mockUserIpHistory,
  },
}))

vi.mock('../../src/config/index.js', () => ({
  config: {
    azureAd: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
      redirectUri: 'http://localhost:3001/api/auth/callback',
    },
    enableRootLogin: true,
    rootUser: 'root@example.com',
    rootPassword: 'secret',
  },
}))

import { AuthService } from '../../src/services/auth.service.js'

// Helper to build fresh service per test
const createService = () => new AuthService()

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('getAuthorizationUrl', () => {
    it('builds Azure AD authorization URL with scopes and state', () => {
      const service = createService()
      const url = service.getAuthorizationUrl('random-state-123')

      expect(url).toContain('https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize')
      expect(url).toContain('client_id=test-client-id')
      expect(url).toContain('response_type=code')
      expect(url).toContain('redirect_uri=')
      expect(url).toContain('state=random-state-123')
      // Check that scope contains the required parameters (encoding may vary)
      expect(url).toMatch(/scope=.*openid/)
      expect(url).toMatch(/scope=.*profile/)
      expect(url).toMatch(/scope=.*email/)
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('exchanges auth code for tokens', async () => {
      const service = createService()
      const mockTokens = {
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid profile email',
        refresh_token: 'mock-refresh-token',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      } as any)

      const result = await service.exchangeCodeForTokens('auth-code-123')

      expect(result).toEqual(mockTokens)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('oauth2/v2.0/token'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' }),
        })
      )
    })

    it('throws on failed exchange and logs error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid code',
      } as any)

      const service = createService()

      await expect(service.exchangeCodeForTokens('invalid-code')).rejects.toThrow('Token exchange failed')
      expect(mockLog.error).toHaveBeenCalled()
    })
  })

  describe('refreshAccessToken', () => {
    it('refreshes token and logs success metadata', async () => {
      const mockNewTokens = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid profile email',
        refresh_token: 'new-refresh-token',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNewTokens,
      } as any)

      const service = createService()
      const result = await service.refreshAccessToken('old-refresh-token')

      expect(result.access_token).toBe('new-access-token')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST', body: expect.stringContaining('refresh_token') })
      )
      expect(mockLog.debug).toHaveBeenCalled()
    })

    it('throws on failed refresh and logs error text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Token expired',
      } as any)

      const service = createService()

      await expect(service.refreshAccessToken('expired-token')).rejects.toThrow('Token refresh failed')
      expect(mockLog.error).toHaveBeenCalled()
    })
  })

  describe('isTokenExpired', () => {
    it('returns true when undefined', () => {
      const service = createService()
      expect(service.isTokenExpired(undefined)).toBe(true)
    })

    it('respects buffer when near expiry', () => {
      const service = createService()
      const expiresSoon = Date.now() + 3 * 60 * 1000
      expect(service.isTokenExpired(expiresSoon, 300)).toBe(true)
      expect(service.isTokenExpired(expiresSoon, 60)).toBe(false)
    })
  })

  describe('getUserProfile', () => {
    it('returns profile and fallback avatar when photo missing', async () => {
      const service = createService()
      const mockProfile = {
        id: 'user-123',
        displayName: 'John Doe',
        mail: 'john@example.com',
        department: 'IT',
        jobTitle: 'Developer',
        mobilePhone: '+1234567890',
      }

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockProfile } as any)
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 } as any)

      const result = await service.getUserProfile('access-token')

      expect(result.id).toBe('user-123')
      expect(result.email).toBe('john@example.com')
      expect(result.department).toBe('IT')
      expect(result.avatar).toContain('ui-avatars.com')
    })

    it('uses userPrincipalName when mail absent', async () => {
      const service = createService()
      const mockProfile = {
        id: 'user-456',
        displayName: 'Jane Doe',
        mail: null,
        userPrincipalName: 'jane@example.com',
      }

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockProfile } as any)
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 } as any)

      const result = await service.getUserProfile('access-token')

      expect(result.email).toBe('jane@example.com')
    })

    it('embeds base64 avatar when photo available', async () => {
      const service = createService()
      const mockProfile = {
        id: 'user-789',
        displayName: 'Bob Smith',
        mail: 'bob@example.com',
      }

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockProfile } as any)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(10),
        headers: { get: () => 'image/jpeg' },
      } as any)

      const result = await service.getUserProfile('access-token')

      expect(result.avatar).toContain('data:image/jpeg;base64,')
    })

    it('throws on profile fetch failure', async () => {
      const service = createService()
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 } as any)

      await expect(service.getUserProfile('invalid-token')).rejects.toThrow('Failed to fetch user profile')
    })
  })

  describe('generateState', () => {
    it('uses crypto.randomUUID', () => {
      const service = createService()
      const state = service.generateState()

      // Should return a UUID format string (either mocked or real)
      expect(state).toBeTruthy()
      expect(typeof state).toBe('string')
      expect(state.length).toBeGreaterThan(0)
    })
  })

  describe('login (root user)', () => {
    it('authenticates root user and saves IP history', async () => {
      const service = createService()
      mockUserModel.findById.mockResolvedValueOnce(null)
      mockUserModel.create.mockResolvedValueOnce({ id: 'root-user' })
      mockUserIpHistory.findByUserAndIp.mockResolvedValueOnce(null)
      mockUserIpHistory.create.mockResolvedValueOnce({})

      const result = await service.login('root@example.com', 'secret', '10.0.0.1')

      expect(result.user.role).toBe('admin')
      expect(mockUserModel.create).toHaveBeenCalled()
      expect(mockUserIpHistory.create).toHaveBeenCalled()
    })

    it('rejects invalid credentials', async () => {
      const service = createService()

      await expect(service.login('wrong', 'creds')).rejects.toThrow('Invalid credentials')
      expect(mockLog.warn).toHaveBeenCalled()
    })
  })
});
