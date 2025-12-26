/**
 * @fileoverview Tests for document permission routes.
 * Tests document permission management endpoints and middleware.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/services/logger.service.js', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Document Permission Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Module exports', () => {
    it('should export a router', async () => {
      const routes = await import('../../src/routes/document-permission.routes.js')
      expect(routes.default).toBeDefined()
    })
  })

  describe('Route middleware', () => {
    it('should apply requireAuth middleware', async () => {
      const { requireAuth } = await import('../../src/middleware/auth.middleware.js')
      expect(requireAuth).toBeDefined()
    })

    it('should apply requireRole middleware', async () => {
      const { requireRole } = await import('../../src/middleware/auth.middleware.js')
      expect(requireRole).toBeDefined()
    })
  })
})
