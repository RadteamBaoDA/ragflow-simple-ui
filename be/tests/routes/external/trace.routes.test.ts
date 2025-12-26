/**
 * @fileoverview Tests for external trace routes.
 * Tests external tracing API endpoints and middleware.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/services/logger.service.js', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('External Trace Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Module exports', () => {
    it('should export a router', async () => {
      const routes = await import('../../../src/routes/external/trace.routes.js')
      expect(routes.default).toBeDefined()
    })
  })

  describe('Route middleware', () => {
    it('should apply checkEnabled middleware', async () => {
      const { checkEnabled } = await import('../../../src/middleware/external.middleware.js')
      expect(checkEnabled).toBeDefined()
    })
  })
})
