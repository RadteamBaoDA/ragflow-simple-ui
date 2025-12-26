/**
 * @fileoverview Tests for BroadcastMessageController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BroadcastMessageController } from '../../src/controllers/broadcast-message.controller.js'

const mockService = vi.hoisted(() => ({
  getActiveMessages: vi.fn(),
  getAllMessages: vi.fn(),
  createMessage: vi.fn(),
  updateMessage: vi.fn(),
  deleteMessage: vi.fn(),
  dismissMessage: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('../../src/services/broadcast-message.service.js', () => ({
  broadcastMessageService: mockService,
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

const makeReq = (override: Record<string, any> = {}) => ({ headers: {}, socket: { remoteAddress: '1.1.1.1' }, ...override })

describe('BroadcastMessageController', () => {
  const controller = new BroadcastMessageController()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getActive returns active messages for user', async () => {
    const res = makeRes()
    mockService.getActiveMessages.mockResolvedValueOnce([{ id: 'm1' }])

    await controller.getActive(makeReq({ user: { id: 'u1' } }), res)

    expect(mockService.getActiveMessages).toHaveBeenCalledWith('u1')
    expect(res.json).toHaveBeenCalledWith([{ id: 'm1' }])
  })

  it('getActive handles errors', async () => {
    const res = makeRes()
    mockService.getActiveMessages.mockRejectedValueOnce(new Error('fail'))

    await controller.getActive(makeReq({ user: { id: 'u1' } }), res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getAll returns all messages', async () => {
    const res = makeRes()
    mockService.getAllMessages.mockResolvedValueOnce([{ id: 'm1' }, { id: 'm2' }])

    await controller.getAll(makeReq(), res)

    expect(res.json).toHaveBeenCalledWith([{ id: 'm1' }, { id: 'm2' }])
  })

  it('getAll handles errors', async () => {
    const res = makeRes()
    mockService.getAllMessages.mockRejectedValueOnce(new Error('fail'))

    await controller.getAll(makeReq(), res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('create creates message and returns 201', async () => {
    const res = makeRes()
    mockService.createMessage.mockResolvedValueOnce({ id: 'm1' })

    await controller.create(makeReq({ body: { title: 'T' }, user: { id: 'u', email: 'e' } }), res)

    expect(mockService.createMessage).toHaveBeenCalledWith({ title: 'T' }, expect.any(Object))
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ id: 'm1' })
  })

  it('create handles errors', async () => {
    const res = makeRes()
    mockService.createMessage.mockRejectedValueOnce(new Error('fail'))

    await controller.create(makeReq({ body: {}, user: { id: 'u', email: 'e' } }), res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('update validates missing id', async () => {
    const res = makeRes()

    await controller.update(makeReq({ params: {} }), res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('update returns 404 when not found', async () => {
    const res = makeRes()
    mockService.updateMessage.mockResolvedValueOnce(undefined)

    await controller.update(makeReq({ params: { id: 'm1' }, body: {}, user: { id: 'u', email: 'e' } }), res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('update updates and returns message', async () => {
    const res = makeRes()
    mockService.updateMessage.mockResolvedValueOnce({ id: 'm1', title: 'new' })

    await controller.update(makeReq({ params: { id: 'm1' }, body: { title: 'new' }, user: { id: 'u', email: 'e' } }), res)

    expect(res.json).toHaveBeenCalledWith({ id: 'm1', title: 'new' })
  })

  it('update handles errors', async () => {
    const res = makeRes()
    mockService.updateMessage.mockRejectedValueOnce(new Error('fail'))

    await controller.update(makeReq({ params: { id: 'm1' }, body: {}, user: { id: 'u', email: 'e' } }), res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('delete validates missing id', async () => {
    const res = makeRes()

    await controller.delete(makeReq({ params: {} }), res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('delete returns 404 when not found', async () => {
    const res = makeRes()
    mockService.deleteMessage.mockResolvedValueOnce(false)

    await controller.delete(makeReq({ params: { id: 'm1' }, user: { id: 'u', email: 'e' } }), res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('delete deletes and returns success', async () => {
    const res = makeRes()
    mockService.deleteMessage.mockResolvedValueOnce(true)

    await controller.delete(makeReq({ params: { id: 'm1' }, user: { id: 'u', email: 'e' } }), res)

    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  it('delete handles errors', async () => {
    const res = makeRes()
    mockService.deleteMessage.mockRejectedValueOnce(new Error('fail'))

    await controller.delete(makeReq({ params: { id: 'm1' }, user: { id: 'u', email: 'e' } }), res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('dismiss returns local-only for unauthenticated', async () => {
    const res = makeRes()

    await controller.dismiss(makeReq({ params: { id: 'm1' } }), res)

    expect(res.json).toHaveBeenCalledWith({ success: true, localOnly: true })
  })

  it('dismiss validates missing id', async () => {
    const res = makeRes()

    await controller.dismiss(makeReq({ params: {}, user: { id: 'u' } }), res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('dismiss dismisses message for authenticated user', async () => {
    const res = makeRes()

    await controller.dismiss(makeReq({ params: { id: 'm1' }, user: { id: 'u', email: 'e' } }), res)

    expect(mockService.dismissMessage).toHaveBeenCalledWith('u', 'm1', 'e', '1.1.1.1')
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  it('dismiss handles errors', async () => {
    const res = makeRes()
    mockService.dismissMessage.mockRejectedValueOnce(new Error('fail'))

    await controller.dismiss(makeReq({ params: { id: 'm1' }, user: { id: 'u', email: 'e' } }), res)

    expect(res.status).toHaveBeenCalledWith(500)
  })
})
