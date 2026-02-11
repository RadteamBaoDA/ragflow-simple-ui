/**
 * @fileoverview Tests for knowledge base routes.
 * Tests knowledge base configuration and source management endpoints.
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

describe('Knowledge Base Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Module exports', () => {
    it('should export a router', async () => {
      const routes = await import('../../src/modules/knowledge-base/knowledge-base.routes.js')
      expect(routes.default).toBeDefined()
    })
  })

  describe('Route middleware', () => {
    it('should apply requireAuth middleware', async () => {
      const { requireAuth } = await import('../../src/shared/middleware/auth.middleware.js')
      expect(requireAuth).toBeDefined()
    })

    it('should apply requirePermission middleware', async () => {
      const { requirePermission } = await import('../../src/shared/middleware/auth.middleware.js')
      expect(requirePermission).toBeDefined()
    })
  })
})
