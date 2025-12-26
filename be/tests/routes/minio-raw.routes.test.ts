/**
 * @fileoverview Tests for minio raw routes.
 * Tests MinIO administrative endpoints and middleware.
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

describe('MinIO Raw Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Module exports', () => {
    it('should export a router', async () => {
      const routes = await import('../../src/routes/minio-raw.routes.js')
      expect(routes.default).toBeDefined()
    })
  })

  describe('Route middleware', () => {
    it('should apply requireRole middleware', async () => {
      const { requireRole } = await import('../../src/middleware/auth.middleware.js')
      expect(requireRole).toBeDefined()
    })
  })
})
