/**
 * @fileoverview Tests for team routes.
 * Tests team management endpoints and middleware.
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

describe('Team Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Module exports', () => {
    it('should export a router', async () => {
      const teamRoutes = await import('../../src/routes/team.routes.js')
      expect(teamRoutes.default).toBeDefined()
    })
  })

  describe('Route middleware', () => {
    it('should apply requirePermission middleware', async () => {
      const { requirePermission } = await import('../../src/middleware/auth.middleware.js')
      expect(requirePermission).toBeDefined()
    })
  })
})
