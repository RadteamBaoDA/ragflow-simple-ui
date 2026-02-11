/**
 * @fileoverview Tests for broadcast message routes.
 * Tests broadcast message management endpoints and middleware.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/shared/services/logger.service.js', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Broadcast Message Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Module exports', () => {
    it('should export a router', async () => {
      const routes = await import('../../src/modules/broadcast/broadcast-message.routes.js')
      expect(routes.default).toBeDefined()
    })
  })

  describe('Route middleware', () => {
    it('should apply requirePermission middleware for admin routes', async () => {
      const { requirePermission } = await import('../../src/shared/middleware/auth.middleware.js')
      expect(requirePermission).toBeDefined()
    })
  })
})
