/**
 * @fileoverview Tests for DocumentPermissionController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentPermissionController } from '../../src/controllers/document-permission.controller.js'

const PermissionLevel = vi.hoisted(() => ({
  NONE: 0,
  VIEW: 1,
  UPLOAD: 2,
  FULL: 3,
}))

const mockService = vi.hoisted(() => ({
  getAllPermissions: vi.fn(),
  setPermission: vi.fn(),
  resolveUserPermission: vi.fn(),
}))

const mockUserService = vi.hoisted(() => ({
  getUserById: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('../../src/services/document-permission.service.js', () => ({
  documentPermissionService: mockService,
  PermissionLevel,
}))

vi.mock('../../src/services/user.service.js', () => ({
  userService: mockUserService,
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

describe('DocumentPermissionController', () => {
  const controller = new DocumentPermissionController()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getAllPermissions returns perms', async () => {
    const res = makeRes()
    mockService.getAllPermissions.mockResolvedValueOnce([{ id: 'p1' }])

    await controller.getAllPermissions({ query: {} } as any, res)

    expect(res.json).toHaveBeenCalledWith([{ id: 'p1' }])
  })

  it('getAllPermissions handles errors', async () => {
    const res = makeRes()
    mockService.getAllPermissions.mockRejectedValueOnce(new Error('boom'))

    await controller.getAllPermissions({ query: {} } as any, res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('setPermission rejects invalid input', async () => {
    const res = makeRes()

    await controller.setPermission({ body: { entityType: 'x' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('setPermission validates leader user and returns 403', async () => {
    const res = makeRes()
    mockUserService.getUserById.mockResolvedValueOnce({ id: 'u', role: 'user' })

    await controller.setPermission({ body: { entityType: 'user', entityId: 'u', bucketId: 'b', level: PermissionLevel.VIEW } } as any, res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('setPermission returns 404 when user missing', async () => {
    const res = makeRes()
    mockUserService.getUserById.mockResolvedValueOnce(undefined)

    await controller.setPermission({ body: { entityType: 'user', entityId: 'u', bucketId: 'b', level: PermissionLevel.VIEW } } as any, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('setPermission calls service with actor when valid', async () => {
    const res = makeRes()
    mockUserService.getUserById.mockResolvedValueOnce({ id: 'u', role: 'leader', email: 'e' })

    await controller.setPermission({ body: { entityType: 'user', entityId: 'u', bucketId: 'b', level: PermissionLevel.FULL }, user: { id: 'actor', email: 'a@example.com', role: 'admin' }, headers: {}, socket: { remoteAddress: '1.1.1.1' } } as any, res)

    expect(mockService.setPermission).toHaveBeenCalledWith('user', 'u', 'b', PermissionLevel.FULL, expect.objectContaining({ id: 'actor' }))
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  it('setPermission handles errors with 500', async () => {
    const res = makeRes()
    mockUserService.getUserById.mockResolvedValueOnce({ id: 'u', role: 'leader' })
    mockService.setPermission.mockRejectedValueOnce(new Error('fail'))

    await controller.setPermission({ body: { entityType: 'user', entityId: 'u', bucketId: 'b', level: PermissionLevel.VIEW }, user: { id: 'actor', email: 'a' }, socket: { remoteAddress: '1.1.1.1' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(mockLog.error).toHaveBeenCalled()
  })

  it('resolveUserPermission returns 401 when missing user', async () => {
    const res = makeRes()

    await controller.resolveUserPermission({ query: { bucketId: 'b' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('resolveUserPermission returns 400 when missing bucket', async () => {
    const res = makeRes()

    await controller.resolveUserPermission({ user: { id: 'u' }, query: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('resolveUserPermission short-circuits admin', async () => {
    const res = makeRes()

    await controller.resolveUserPermission({ user: { id: 'u', role: 'admin' }, query: { bucketId: 'b' }, socket: { remoteAddress: '1.1.1.1' } } as any, res)

    expect(res.json).toHaveBeenCalledWith({ level: PermissionLevel.FULL })
  })

  it('resolveUserPermission calls service and returns level', async () => {
    const res = makeRes()
    mockService.resolveUserPermission.mockResolvedValueOnce(PermissionLevel.UPLOAD)

    await controller.resolveUserPermission({ user: { id: 'u', role: 'user' }, query: { bucketId: 'b' }, socket: { remoteAddress: '1.1.1.1' } } as any, res)

    expect(mockService.resolveUserPermission).toHaveBeenCalledWith('u', 'b')
    expect(res.json).toHaveBeenCalledWith({ level: PermissionLevel.UPLOAD })
  })

  it('resolveUserPermission handles errors', async () => {
    const res = makeRes()
    mockService.resolveUserPermission.mockRejectedValueOnce(new Error('fail'))

    await controller.resolveUserPermission({ user: { id: 'u', role: 'user' }, query: { bucketId: 'b' }, socket: { remoteAddress: '1.1.1.1' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(mockLog.error).toHaveBeenCalled()
  })
})
