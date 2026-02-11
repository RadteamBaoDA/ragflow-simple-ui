/**
 * @fileoverview Tests for SystemToolsController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SystemToolsController } from '../../src/modules/system-tools/system-tools.controller.js'

const mockService = vi.hoisted(() => ({
  getTools: vi.fn(),
  getSystemHealth: vi.fn(),
  runTool: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('../../src/modules/system-tools/system-tools.service.js', () => ({
  systemToolsService: mockService,
}))

vi.mock('../../src/shared/services/logger.service.js', () => ({
  log: mockLog,
}))

const makeRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('SystemToolsController', () => {
  const controller = new SystemToolsController()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getTools returns tools list with count', async () => {
    const res = makeRes()
    mockService.getTools.mockResolvedValueOnce([{ id: 't1' }, { id: 't2' }])

    await controller.getTools({} as any, res)

    expect(res.json).toHaveBeenCalledWith({ tools: [{ id: 't1' }, { id: 't2' }], count: 2 })
  })

  it('getTools handles errors', async () => {
    const res = makeRes()
    mockService.getTools.mockRejectedValueOnce(new Error('fail'))

    await controller.getTools({} as any, res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getHealth returns health status', async () => {
    const res = makeRes()
    mockService.getSystemHealth.mockResolvedValueOnce({ status: 'healthy' })

    await controller.getHealth({} as any, res)

    expect(res.json).toHaveBeenCalledWith({ status: 'healthy' })
  })

  it('getHealth handles errors', async () => {
    const res = makeRes()
    mockService.getSystemHealth.mockRejectedValueOnce(new Error('fail'))

    await controller.getHealth({} as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('runTool validates missing id', async () => {
    const res = makeRes()

    await controller.runTool({ params: {}, body: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('runTool executes tool and returns result', async () => {
    const res = makeRes()
    mockService.runTool.mockResolvedValueOnce({ success: true, output: 'done' })

    await controller.runTool({ params: { id: 't1' }, body: { param: 'value' } } as any, res)

    expect(mockService.runTool).toHaveBeenCalledWith('t1', { param: 'value' })
    expect(res.json).toHaveBeenCalledWith({ success: true, output: 'done' })
  })

  it('runTool handles errors', async () => {
    const res = makeRes()
    mockService.runTool.mockRejectedValueOnce(new Error('fail'))

    await controller.runTool({ params: { id: 't1' }, body: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })
})
