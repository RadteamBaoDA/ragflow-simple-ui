import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PromptPermissionController, promptPermissionController } from '@/controllers/prompt-permission.controller.js'
import { promptPermissionService } from '@/services/prompt-permission.service.js'

const makeReq = (overrides: any = {}) => ({ body: {}, user: { id: 'u1', email: 'a@b.com' }, ip: '1.2.3.4', socket: { remoteAddress: '1.2.3.4' }, ...overrides }) as any
const makeRes = () => ({ status: vi.fn(() => ({ json: vi.fn() })), json: vi.fn() } as any)

describe('PromptPermissionController', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('getPermissions returns permissions', async () => {
    const req = makeReq()
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'getAllPermissions').mockResolvedValue([{ id: 'p' } as any])
    await promptPermissionController.getPermissions(req, res)
    expect(res.json).toHaveBeenCalledWith([{ id: 'p' }])
  })

  it('setPermission validates input', async () => {
    const reqBad = makeReq({ body: {} })
    const resBad = makeRes()
    await promptPermissionController.setPermission(reqBad, resBad)
    expect(resBad.status).toHaveBeenCalledWith(400)

    const req = makeReq({ body: { entityType: 'user', entityId: 'u2', level: 1 } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'setPermission').mockResolvedValue(undefined)
    await promptPermissionController.setPermission(req, res)
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  it('getMyPermission returns level', async () => {
    const req = makeReq({ user: { id: 'u1' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(2)
    await promptPermissionController.getMyPermission(req, res)
    expect(res.json).toHaveBeenCalledWith({ level: 2 })
  })
})