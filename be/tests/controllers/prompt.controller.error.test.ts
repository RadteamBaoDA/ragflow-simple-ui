import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PromptController } from '@/controllers/prompt.controller.js'
import { promptService } from '@/services/prompt.service.js'
import { promptPermissionService } from '@/services/prompt-permission.service.js'
import { PermissionLevel } from '@/models/types.js'

const makeReq = (overrides: any = {}) => ({ params: {}, query: {}, body: {}, user: { id: 'u1', email: 'a@b.com' }, ip: '1.2.3.4', socket: { remoteAddress: '1.2.3.4' }, ...overrides }) as any
const makeRes = () => {
  const json = vi.fn()
  const send = vi.fn()
  return { status: vi.fn(() => ({ json, send })), json, send } as any
}

describe('PromptController error branches', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('getPrompts returns 500 when service throws', async () => {
    const req = makeReq()
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.VIEW)
    vi.spyOn(promptService, 'getPrompts').mockRejectedValueOnce(new Error('boom'))
    await PromptController.getPrompts(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('createPrompt returns 500 when service throws', async () => {
    const req = makeReq()
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.UPLOAD)
    vi.spyOn(promptService, 'createPrompt').mockRejectedValueOnce(new Error('boom'))
    await PromptController.createPrompt(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('updatePrompt returns 500 when service throws', async () => {
    const req = makeReq({ params: { id: 'p' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.UPLOAD)
    vi.spyOn(promptService, 'updatePrompt').mockRejectedValueOnce(new Error('boom'))
    await PromptController.updatePrompt(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('deletePrompt returns 500 when service throws', async () => {
    const req = makeReq({ user: { id: 'u1' }, params: { id: 'p' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.FULL)
    vi.spyOn(promptService, 'deletePrompt').mockRejectedValueOnce(new Error('boom'))
    await PromptController.deletePrompt(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('addInteraction returns 500 when service throws', async () => {
    const req = makeReq({ user: { id: 'u1' } })
    const res = makeRes()
    vi.spyOn(promptService, 'addInteraction').mockRejectedValueOnce(new Error('boom'))
    await PromptController.addInteraction(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getTags returns 500 when service throws', async () => {
    const req = makeReq({ user: { id: 'u1' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.VIEW)
    vi.spyOn(promptService, 'getAllTags').mockRejectedValueOnce(new Error('boom'))
    await PromptController.getTags(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getFeedbackCounts returns 500 when service throws', async () => {
    const req = makeReq({ user: { id: 'u1' }, params: { id: 'p' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.VIEW)
    vi.spyOn(promptService, 'getFeedbackCounts').mockRejectedValueOnce(new Error('boom'))
    await PromptController.getFeedbackCounts(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getInteractions returns 500 when service throws', async () => {
    const req = makeReq({ user: { id: 'u1' }, params: { id: 'p' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.VIEW)
    vi.spyOn(promptService, 'getInteractionsForPrompt').mockRejectedValueOnce(new Error('boom'))
    await PromptController.getInteractions(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getSources and getChatSources return 500 when service throws', async () => {
    const req = makeReq({ user: { id: 'u1' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.VIEW)
    vi.spyOn(promptService, 'getAllSources').mockRejectedValueOnce(new Error('boom'))
    await PromptController.getSources(req, res)
    expect(res.status).toHaveBeenCalledWith(500)

    vi.spyOn(promptService, 'getChatSourceNames').mockRejectedValueOnce(new Error('boom'))
    await PromptController.getChatSources(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})