/**
 * @fileoverview Tests for UserController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserController } from '../../src/controllers/user.controller.js'

const mockUserService = vi.hoisted(() => ({
  getAllUsers: vi.fn(),
  getAllUsersIpHistory: vi.fn(),
  getUserIpHistory: vi.fn(),
  updateUserRole: vi.fn(),
  updateUserPermissions: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  getUserById: vi.fn(),
}))

const mockAudit = vi.hoisted(() => ({
  log: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

const mockGetClientIp = vi.hoisted(() => vi.fn().mockReturnValue('127.0.0.1'))

vi.mock('../../src/services/user.service.js', () => ({
  userService: mockUserService,
}))

vi.mock('../../src/services/audit.service.js', () => ({
  auditService: mockAudit,
  AuditAction: { UPDATE_ROLE: 'update_role' },
  AuditResourceType: { USER: 'user' },
}))

vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}))

vi.mock('../../src/utils/ip.js', () => ({
  getClientIp: mockGetClientIp,
}))

const makeRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.send = vi.fn(() => res)
  return res
}

const socket = { remoteAddress: '1.1.1.1' }
const makeReq = (override: Record<string, any> = {}) => ({ headers: {}, socket, ...override })

describe('UserController', () => {
  const controller = new UserController()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getUsers forwards roles filter', async () => {
    const res = makeRes()
    mockUserService.getAllUsers.mockResolvedValueOnce([{ id: 'u1' }])

    await controller.getUsers({ query: { roles: 'admin,user' } } as any, res)

    expect(mockUserService.getAllUsers).toHaveBeenCalledWith(['admin', 'user'])
    expect(res.json).toHaveBeenCalledWith([{ id: 'u1' }])
  })

  it('getUsers handles service errors', async () => {
    const res = makeRes()
    mockUserService.getAllUsers.mockRejectedValueOnce(new Error('boom'))

    await controller.getUsers({} as any, res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getAllIpHistory handles service errors', async () => {
    const res = makeRes()
    mockUserService.getAllUsersIpHistory.mockRejectedValueOnce(new Error('boom'))

    await controller.getAllIpHistory({} as any, res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getAllIpHistory converts map', async () => {
    const res = makeRes()
    const map = new Map<string, any[]>([['u1', [{ ip: '1.1.1.1' }]]])
    mockUserService.getAllUsersIpHistory.mockResolvedValueOnce(map)

    await controller.getAllIpHistory({} as any, res)

    expect(res.json).toHaveBeenCalledWith({ u1: [{ ip: '1.1.1.1' }] })
  })

  it('getUserIpHistory validates id', async () => {
    const res = makeRes()

    await controller.getUserIpHistory({ params: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('getUserIpHistory returns data', async () => {
    const res = makeRes()
    mockUserService.getUserIpHistory.mockResolvedValueOnce([{ ip: '1.1.1.1' }])

    await controller.getUserIpHistory({ params: { id: 'u1' } } as any, res)

    expect(res.json).toHaveBeenCalledWith([{ ip: '1.1.1.1' }])
  })

  it('updateUserRole validates invalid input', async () => {
    const res = makeRes()

    await controller.updateUserRole({ params: { id: 123 as any }, body: {}, session: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('updateUserRole blocks self change', async () => {
    const res = makeRes()
    mockUserService.updateUserRole.mockRejectedValueOnce(new Error('Cannot modify your own role'))

    await controller.updateUserRole({ params: { id: 'self' }, body: { role: 'leader' }, session: { user: { id: 'self', email: 'u@a.com' } } } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('updateUserRole blocks non-admin promoting admin', async () => {
    const res = makeRes()
    mockUserService.updateUserRole.mockRejectedValueOnce(new Error('Only administrators can grant admin role'))

    await controller.updateUserRole(makeReq({ params: { id: '00000000-0000-0000-0000-000000000000' }, body: { role: 'admin' }, session: { user: { id: 'mgr', role: 'leader', email: 'm@a.com' } } }) as any, res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('updateUserRole returns 404 when not found', async () => {
    const res = makeRes()
    mockUserService.updateUserRole.mockResolvedValueOnce(undefined)

    await controller.updateUserRole({ params: { id: 'root-user' }, body: { role: 'user' }, session: { user: { id: 'admin', role: 'admin', email: 'a@a.com' } } } as any, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('updateUserRole success audits', async () => {
    const res = makeRes()
    mockUserService.updateUserRole.mockResolvedValueOnce({ id: 'u1', email: 'e' })

    await controller.updateUserRole(makeReq({ params: { id: 'root-user' }, body: { role: 'leader', oldRole: 'user' }, session: { user: { id: 'admin', role: 'admin', email: 'a@a.com' } } }) as any, res)

    expect(res.json).toHaveBeenCalledWith({ id: 'u1', email: 'e' })
    expect(mockUserService.updateUserRole).toHaveBeenCalledWith('root-user', 'leader', expect.objectContaining({
      id: 'admin',
      role: 'admin',
      email: 'a@a.com'
    }))
  })

  it('updateUserPermissions validates input', async () => {
    const res = makeRes()

    await controller.updateUserPermissions({ params: {}, body: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)

    await controller.updateUserPermissions({ params: { id: 'u1' }, body: { permissions: 'x' } as any } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('updateUserPermissions succeeds', async () => {
    const res = makeRes()

    await controller.updateUserPermissions(makeReq({ params: { id: 'u1' }, body: { permissions: ['p1'] }, user: { id: 'u', email: 'e' } }) as any, res)

    expect(mockUserService.updateUserPermissions).toHaveBeenCalledWith('u1', ['p1'], expect.any(Object))
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  it('createUser returns created', async () => {
    const res = makeRes()
    mockUserService.createUser.mockResolvedValueOnce({ id: 'u1' })

    await controller.createUser(makeReq({ body: { email: 'e' }, user: { id: 'u', email: 'e' } }) as any, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ id: 'u1' })
  })

  it('updateUser validates id and not found', async () => {
    const res = makeRes()

    await controller.updateUser({ params: {}, body: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)

    mockUserService.updateUser.mockResolvedValueOnce(undefined)
    await controller.updateUser(makeReq({ params: { id: 'u1' }, body: {}, user: { id: 'u', email: 'e' } }) as any, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('updateUser returns updated', async () => {
    const res = makeRes()
    mockUserService.updateUser.mockResolvedValueOnce({ id: 'u1' })

    await controller.updateUser(makeReq({ params: { id: 'u1' }, body: { displayName: 'D' }, user: { id: 'u', email: 'e' } }) as any, res)

    expect(res.json).toHaveBeenCalledWith({ id: 'u1' })
  })

  it('deleteUser validates id then deletes', async () => {
    const res = makeRes()

    await controller.deleteUser({ params: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)

    await controller.deleteUser(makeReq({ params: { id: 'u1' }, user: { id: 'u', email: 'e' } }) as any, res)
    expect(mockUserService.deleteUser).toHaveBeenCalledWith('u1', expect.any(Object))
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('getMe returns 401 when no user', async () => {
    const res = makeRes()

    await controller.getMe({} as any, res)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('getMe returns 404 when missing', async () => {
    const res = makeRes()
    mockUserService.getUserById.mockResolvedValueOnce(undefined)

    await controller.getMe({ user: { id: 'u' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('getMe returns current user', async () => {
    const res = makeRes()
    mockUserService.getUserById.mockResolvedValueOnce({ id: 'u' })

    await controller.getMe({ user: { id: 'u' } } as any, res)

    expect(res.json).toHaveBeenCalledWith({ id: 'u' })
  })
})
