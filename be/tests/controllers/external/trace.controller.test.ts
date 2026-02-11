/**
 * @fileoverview Tests for External TraceController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExternalTraceController } from '../../../src/modules/external/trace.controller.js'

const mockService = vi.hoisted(() => ({
  processTrace: vi.fn(),
  processFeedback: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('../../../src/modules/external/trace.service.js', () => ({
  externalTraceService: mockService,
}))

vi.mock('../../../src/shared/services/logger.service.js', () => ({
  log: mockLog,
}))

const makeRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

const makeReq = (override: Record<string, any> = {}) => ({ headers: {}, socket: { remoteAddress: '1.1.1.1' }, body: {}, ...override })

describe('ExternalTraceController', () => {
  const controller = new ExternalTraceController()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submitTrace adds IP and processes trace', async () => {
    const res = makeRes()
    mockService.processTrace.mockResolvedValueOnce({ success: true, id: 't1' })

    await controller.submitTrace(makeReq({ body: { traceId: 't1', data: 'test' } }), res)

    expect(mockService.processTrace).toHaveBeenCalledWith(expect.objectContaining({
      traceId: 't1',
      data: 'test',
      ipAddress: '1.1.1.1',
    }))
    expect(res.json).toHaveBeenCalledWith({ success: true, id: 't1' })
  })

  it('submitTrace handles errors', async () => {
    const res = makeRes()
    mockService.processTrace.mockRejectedValueOnce(new Error('fail'))

    await controller.submitTrace(makeReq({ body: {} }), res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('submitFeedback adds IP and processes feedback', async () => {
    const res = makeRes()
    mockService.processFeedback.mockResolvedValueOnce({ success: true })

    await controller.submitFeedback(makeReq({ body: { traceId: 't1', score: 5 } }), res)

    expect(mockService.processFeedback).toHaveBeenCalledWith(expect.objectContaining({
      traceId: 't1',
      score: 5,
      ipAddress: '1.1.1.1',
    }))
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  it('submitFeedback handles errors', async () => {
    const res = makeRes()
    mockService.processFeedback.mockRejectedValueOnce(new Error('fail'))

    await controller.submitFeedback(makeReq({ body: {} }), res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getHealth returns health status', async () => {
    const res = makeRes()

    await controller.getHealth({} as any, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      service: 'external-trace',
    }))
  })
})
