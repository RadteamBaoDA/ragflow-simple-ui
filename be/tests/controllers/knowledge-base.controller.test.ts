/**
 * @fileoverview Tests for KnowledgeBaseController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KnowledgeBaseController } from '../../src/controllers/knowledge-base.controller.js'

const mockService = vi.hoisted(() => ({
  getSources: vi.fn(),
  createSource: vi.fn(),
  updateSource: vi.fn(),
  deleteSource: vi.fn(),
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('../../src/services/knowledge-base.service.js', () => ({
  knowledgeBaseService: mockService,
}))

vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}))

const makeRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.send = vi.fn(() => res)
  return res
}

describe('KnowledgeBaseController', () => {
  const controller = new KnowledgeBaseController()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getSources returns list', async () => {
    const res = makeRes()
    mockService.getSources.mockResolvedValueOnce([{ id: 's1' }])

    await controller.getSources({} as any, res)

    expect(res.json).toHaveBeenCalledWith([{ id: 's1' }])
  })

  it('getSources handles errors', async () => {
    const res = makeRes()
    mockService.getSources.mockRejectedValueOnce(new Error('boom'))

    await controller.getSources({} as any, res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('createSource passes user context and returns created', async () => {
    const res = makeRes()
    mockService.createSource.mockResolvedValueOnce({ id: 's1' })
    const req = { body: { name: 'src' }, user: { id: 'u', email: 'e', role: 'admin' }, headers: {}, socket: { remoteAddress: '1.1.1.1' } } as any

    await controller.createSource(req, res)

    expect(mockService.createSource).toHaveBeenCalledWith(req.body, expect.objectContaining({ id: 'u' }))
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ id: 's1' })
  })

  it('createSource handles errors', async () => {
    const res = makeRes()
    mockService.createSource.mockRejectedValueOnce(new Error('fail'))

    await controller.createSource({ body: {}, user: { id: 'u', email: 'e' }, headers: {}, connection: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(mockLog.error).toHaveBeenCalled()
  })

  it('updateSource validates id and returns 400', async () => {
    const res = makeRes()

    await controller.updateSource({ params: {}, body: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('updateSource returns 404 when missing', async () => {
    const res = makeRes()
    mockService.updateSource.mockResolvedValueOnce(undefined)

    await controller.updateSource({ params: { id: 'missing' }, body: {}, user: { id: 'u', email: 'e' }, headers: {}, socket: { remoteAddress: '1.1.1.1' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('updateSource updates and returns result', async () => {
    const res = makeRes()
    mockService.updateSource.mockResolvedValueOnce({ id: 's1', name: 'new' })

    await controller.updateSource({ params: { id: 's1' }, body: { name: 'new' }, user: { id: 'u', email: 'e' }, headers: {}, socket: { remoteAddress: '1.1.1.1' } } as any, res)

    expect(res.json).toHaveBeenCalledWith({ id: 's1', name: 'new' })
  })

  it('deleteSource validates id and returns 400', async () => {
    const res = makeRes()

    await controller.deleteSource({ params: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('deleteSource deletes and returns 204', async () => {
    const res = makeRes()

    await controller.deleteSource({ params: { id: 's1' }, user: { id: 'u', email: 'e' }, headers: {}, socket: { remoteAddress: '1.1.1.1' } } as any, res)

    expect(mockService.deleteSource).toHaveBeenCalledWith('s1', expect.any(Object))
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('getConfig returns config', async () => {
    const res = makeRes()
    mockService.getConfig.mockResolvedValueOnce({ chatSources: [] })

    await controller.getConfig({ user: { id: 'u', email: 'e' }, headers: {}, socket: { remoteAddress: '1.1.1.1' } } as any, res)

    expect(res.json).toHaveBeenCalledWith({ chatSources: [] })
  })

  it('updateConfig saves and returns 204', async () => {
    const res = makeRes()

    await controller.updateConfig({ body: { defaultChatSourceId: 'c1' }, user: { id: 'u', email: 'e' }, headers: {}, socket: { remoteAddress: '1.1.1.1' } } as any, res)

    expect(mockService.updateConfig).toHaveBeenCalledWith({ defaultChatSourceId: 'c1' }, expect.any(Object))
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('updateSource handles errors', async () => {
    const res = makeRes()
    mockService.updateSource.mockRejectedValueOnce(new Error('update fail'))

    await controller.updateSource({ params: { id: 's1' }, body: {}, user: { id: 'u', email: 'e' }, headers: {}, socket: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(mockLog.error).toHaveBeenCalled()
  })

  it('deleteSource handles errors', async () => {
    const res = makeRes()
    mockService.deleteSource.mockRejectedValueOnce(new Error('delete fail'))

    await controller.deleteSource({ params: { id: 's1' }, user: { id: 'u', email: 'e' }, headers: {}, socket: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(mockLog.error).toHaveBeenCalled()
  })

  it('getConfig handles errors', async () => {
    const res = makeRes()
    mockService.getConfig.mockRejectedValueOnce(new Error('config fail'))

    await controller.getConfig({ user: { id: 'u', email: 'e' }, headers: {}, socket: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(mockLog.error).toHaveBeenCalled()
  })

  it('updateConfig handles errors', async () => {
    const res = makeRes()
    mockService.updateConfig.mockRejectedValueOnce(new Error('update config fail'))

    await controller.updateConfig({ body: {}, user: { id: 'u', email: 'e' }, headers: {}, socket: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(mockLog.error).toHaveBeenCalled()
  })
})
