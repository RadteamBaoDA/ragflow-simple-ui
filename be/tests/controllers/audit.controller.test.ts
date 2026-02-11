/**
 * @fileoverview Tests for AuditController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuditController } from '../../src/modules/audit/audit.controller.js'

const mockService = vi.hoisted(() => ({
  getLogs: vi.fn(),
  getActionTypes: vi.fn(),
  getResourceTypes: vi.fn(),
  getResourceHistory: vi.fn(),
  exportLogs: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('../../src/modules/audit/audit.service.js', () => ({
  auditService: mockService,
}))

vi.mock('../../src/shared/services/logger.service.js', () => ({
  log: mockLog,
}))

const makeRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.send = vi.fn(() => res)
  return res
}

describe('AuditController', () => {
  const controller = new AuditController()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getLogs returns paginated logs with defaults', async () => {
    const res = makeRes()
    mockService.getLogs.mockResolvedValueOnce({ logs: [{ id: '1' }], pagination: { total: 1 } })

    await controller.getLogs({ query: {}, session: {} } as any, res)

    expect(mockService.getLogs).toHaveBeenCalledWith({}, 50, 0)
    expect(res.json).toHaveBeenCalledWith({ logs: [{ id: '1' }], pagination: { total: 1 } })
  })

  it('getLogs parses and applies filters', async () => {
    const res = makeRes()
    mockService.getLogs.mockResolvedValueOnce({ logs: [], pagination: { total: 0 } })

    await controller.getLogs({ query: { page: '2', limit: '25', userId: 'u1', action: 'create' }, session: {} } as any, res)

    expect(mockService.getLogs).toHaveBeenCalledWith({ userId: 'u1', action: 'create' }, 25, 25)
    expect(res.json).toHaveBeenCalled()
  })

  it('getLogs enforces max limit', async () => {
    const res = makeRes()
    mockService.getLogs.mockResolvedValueOnce({ logs: [], pagination: { total: 0 } })

    await controller.getLogs({ query: { limit: '500' }, session: {} } as any, res)

    expect(mockService.getLogs).toHaveBeenCalledWith({}, 100, 0)
  })

  it('getLogs handles errors', async () => {
    const res = makeRes()
    mockService.getLogs.mockRejectedValueOnce(new Error('fail'))

    await controller.getLogs({ query: {}, session: {} } as any, res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getActions returns action types', async () => {
    const res = makeRes()
    mockService.getActionTypes.mockResolvedValueOnce(['create', 'update'])

    await controller.getActions({} as any, res)

    expect(res.json).toHaveBeenCalledWith(['create', 'update'])
  })

  it('getActions handles errors', async () => {
    const res = makeRes()
    mockService.getActionTypes.mockRejectedValueOnce(new Error('fail'))

    await controller.getActions({} as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getResourceTypes returns types', async () => {
    const res = makeRes()
    mockService.getResourceTypes.mockResolvedValueOnce(['user', 'team'])

    await controller.getResourceTypes({} as any, res)

    expect(res.json).toHaveBeenCalledWith(['user', 'team'])
  })

  it('getResourceTypes handles errors', async () => {
    const res = makeRes()
    mockService.getResourceTypes.mockRejectedValueOnce(new Error('fail'))

    await controller.getResourceTypes({} as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getResourceHistory validates params', async () => {
    const res = makeRes()

    await controller.getResourceHistory({ params: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('getResourceHistory returns history', async () => {
    const res = makeRes()
    mockService.getResourceHistory.mockResolvedValueOnce([{ id: 'h1' }])

    await controller.getResourceHistory({ params: { type: 'user', id: 'u1' } } as any, res)

    expect(mockService.getResourceHistory).toHaveBeenCalledWith('user', 'u1')
    expect(res.json).toHaveBeenCalledWith([{ id: 'h1' }])
  })

  it('getResourceHistory handles errors', async () => {
    const res = makeRes()
    mockService.getResourceHistory.mockRejectedValueOnce(new Error('fail'))

    await controller.getResourceHistory({ params: { type: 'user', id: 'u1' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })
})
