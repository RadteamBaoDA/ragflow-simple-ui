/**
 * @fileoverview Unit tests for external middleware.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockLog = vi.hoisted(() => ({
  warn: vi.fn(),
}))

vi.mock('../../src/shared/services/logger.service.js', () => ({
  log: mockLog,
}))

vi.mock('../../src/shared/config/index.js', () => ({
  config: {
    externalTrace: { enabled: false }
  }
}))

const mockedConfig = await import('../../src/shared/config/index.js')
const { checkEnabled } = await import('../../src/modules/external/middleware/external.middleware.js')

function buildReqRes() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
  const next = vi.fn()
  return { req: {} as any, res, next }
}

describe('external middleware', () => {
  beforeEach(() => {
    mockLog.warn.mockReset()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('blocks when feature flag disabled', () => {
    mockedConfig.config.externalTrace.enabled = false
    const { req, res, next } = buildReqRes()

    checkEnabled(req, res, next)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'External trace API is not enabled',
    })
    expect(next).not.toHaveBeenCalled()
    expect(mockLog.warn).toHaveBeenCalled()
  })

  it('allows when feature flag enabled', () => {
    mockedConfig.config.externalTrace.enabled = true
    const { req, res, next } = buildReqRes()

    checkEnabled(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })
})
