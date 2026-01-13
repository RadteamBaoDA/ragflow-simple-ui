/**
 * @fileoverview Tests for TeamController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TeamController } from '../../src/controllers/team.controller.js'

const mockService = vi.hoisted(() => ({
  getAllTeams: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  getTeamMembers: vi.fn(),
  addMembersWithAutoRole: vi.fn(),
  removeUserFromTeam: vi.fn(),
  grantPermissionsToTeam: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('../../src/services/team.service.js', () => ({
  teamService: mockService,
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

describe('TeamController', () => {
  const controller = new TeamController()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getTeams returns teams', async () => {
    const res = makeRes()
    mockService.getAllTeams.mockResolvedValueOnce([{ id: 't1' }])

    await controller.getTeams({} as any, res)

    expect(res.json).toHaveBeenCalledWith([{ id: 't1' }])
  })

  it('getTeams handles errors', async () => {
    const res = makeRes()
    mockService.getAllTeams.mockRejectedValueOnce(new Error('boom'))

    await controller.getTeams({} as any, res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('createTeam passes actor and returns created', async () => {
    const res = makeRes()
    mockService.createTeam.mockResolvedValueOnce({ id: 't1' })

    await controller.createTeam(makeReq({ body: { name: 'T' }, user: { id: 'u', email: 'e' } }) as any, res)

    expect(mockService.createTeam).toHaveBeenCalledWith({ name: 'T' }, expect.objectContaining({ id: 'u' }))
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('updateTeam validates missing id', async () => {
    const res = makeRes()

    await controller.updateTeam({ params: {}, body: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('updateTeam returns 404 when not found', async () => {
    const res = makeRes()
    mockService.updateTeam.mockResolvedValueOnce(undefined)

    await controller.updateTeam(makeReq({ params: { id: 'missing' }, body: {}, user: { id: 'u', email: 'e' } }) as any, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('updateTeam returns updated team', async () => {
    const res = makeRes()
    mockService.updateTeam.mockResolvedValueOnce({ id: 't1', name: 'n' })

    await controller.updateTeam(makeReq({ params: { id: 't1' }, body: { name: 'n' }, user: { id: 'u', email: 'e' } }) as any, res)

    expect(res.json).toHaveBeenCalledWith({ id: 't1', name: 'n' })
  })

  it('deleteTeam validates id', async () => {
    const res = makeRes()

    await controller.deleteTeam({ params: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('deleteTeam deletes and returns 204', async () => {
    const res = makeRes()

    await controller.deleteTeam(makeReq({ params: { id: 't1' }, user: { id: 'u', email: 'e' } }) as any, res)

    expect(mockService.deleteTeam).toHaveBeenCalledWith('t1', expect.any(Object))
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('getTeamMembers validates id and returns 400', async () => {
    const res = makeRes()

    await controller.getTeamMembers({ params: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('getTeamMembers returns members', async () => {
    const res = makeRes()
    mockService.getTeamMembers.mockResolvedValueOnce([{ id: 'u1' }])

    await controller.getTeamMembers({ params: { id: 't1' } } as any, res)

    expect(res.json).toHaveBeenCalledWith([{ id: 'u1' }])
  })

  it('addMembers validates missing ids', async () => {
    const res = makeRes()

    await controller.addMembers({ params: { id: 't1' }, body: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('addMembers handles admin add error', async () => {
    const res = makeRes()
    mockService.addMembersWithAutoRole.mockRejectedValueOnce(new Error('Administrators cannot be added to teams'))

    await controller.addMembers({ params: { id: 't1' }, body: { userId: 'u1' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('addMembers succeeds with array', async () => {
    const res = makeRes()

    await controller.addMembers(makeReq({ params: { id: 't1' }, body: { userIds: ['u1', 'u2'] }, user: { id: 'u', email: 'e' } }) as any, res)

    expect(mockService.addMembersWithAutoRole).toHaveBeenCalledWith('t1', ['u1', 'u2'], expect.any(Object))
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('removeMember validates ids', async () => {
    const res = makeRes()

    await controller.removeMember({ params: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('removeMember removes and returns 204', async () => {
    const res = makeRes()

    await controller.removeMember(makeReq({ params: { id: 't1', userId: 'u1' }, user: { id: 'u', email: 'e' } }) as any, res)

    expect(mockService.removeUserFromTeam).toHaveBeenCalledWith('t1', 'u1', expect.any(Object))
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('grantPermissions validates team id and permissions', async () => {
    const res = makeRes()

    await controller.grantPermissions({ params: {}, body: { permissions: [] } } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)

    await controller.grantPermissions({ params: { id: 't1' }, body: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('grantPermissions succeeds', async () => {
    const res = makeRes()

    await controller.grantPermissions(makeReq({ params: { id: 't1' }, body: { permissions: ['p1'] }, user: { id: 'u', email: 'e' } }) as any, res)

    expect(mockService.grantPermissionsToTeam).toHaveBeenCalledWith('t1', ['p1'], expect.any(Object))
    expect(res.json).toHaveBeenCalledWith({ message: 'Permissions granted successfully' })
  })

  // Error branches
  it('createTeam handles errors', async () => {
    const res = makeRes()
    mockService.createTeam.mockRejectedValueOnce(new Error('boom'))
    await controller.createTeam(makeReq({ body: { name: 'T' }, user: { id: 'u', email: 'e' } }) as any, res)
    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('updateTeam handles service errors', async () => {
    const res = makeRes()
    mockService.updateTeam.mockRejectedValueOnce(new Error('boom'))
    await controller.updateTeam(makeReq({ params: { id: 't1' }, body: {} , user: { id: 'u', email: 'e' } }) as any, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('deleteTeam handles errors', async () => {
    const res = makeRes()
    mockService.deleteTeam.mockRejectedValueOnce(new Error('boom'))
    await controller.deleteTeam(makeReq({ params: { id: 't1' }, user: { id: 'u', email: 'e' } }) as any, res)
    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getTeamMembers handles errors', async () => {
    const res = makeRes()
    mockService.getTeamMembers.mockRejectedValueOnce(new Error('boom'))
    await controller.getTeamMembers(makeReq({ params: { id: 't1' } }) as any, res)
    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('addMembers handles Not Found errors', async () => {
    const res = makeRes()
    mockService.addMembersWithAutoRole.mockRejectedValueOnce(new Error('No valid users found'))
    await controller.addMembers(makeReq({ params: { id: 't1' }, body: { userId: 'u1' } }) as any, res)
    expect(res.status).toHaveBeenCalledWith(404)

    mockService.addMembersWithAutoRole.mockRejectedValueOnce(new Error('User not found'))
    await controller.addMembers(makeReq({ params: { id: 't1' }, body: { userId: 'u1' } }) as any, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('addMembers handles generic errors', async () => {
    const res = makeRes()
    mockService.addMembersWithAutoRole.mockRejectedValueOnce(new Error('unexpected'))
    await controller.addMembers(makeReq({ params: { id: 't1' }, body: { userId: 'u1' } }) as any, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('removeMember handles service errors', async () => {
    const res = makeRes()
    mockService.removeUserFromTeam.mockRejectedValueOnce(new Error('boom'))
    await controller.removeMember(makeReq({ params: { id: 't1', userId: 'u1' }, user: { id: 'u', email: 'e' } }) as any, res)
    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('grantPermissions handles service errors', async () => {
    const res = makeRes()
    mockService.grantPermissionsToTeam.mockRejectedValueOnce(new Error('boom'))
    await controller.grantPermissions(makeReq({ params: { id: 't1' }, body: { permissions: ['p1'] }, user: { id: 'u', email: 'e' } }) as any, res)
    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })
})
