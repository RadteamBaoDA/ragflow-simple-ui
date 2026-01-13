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

describe('PromptController', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('getPrompts returns 401 when no user id', async () => {
    const req = makeReq({ user: {} })
    const res = makeRes()
    await PromptController.getPrompts(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('getPrompts returns 403 when permission insufficient', async () => {
    const req = makeReq()
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.NONE)
    await PromptController.getPrompts(req, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('getPrompts returns results when allowed', async () => {
    const req = makeReq({ query: { search: 'x' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.VIEW)
    vi.spyOn(promptService, 'getPrompts').mockResolvedValue({ items: [] } as any)
    await PromptController.getPrompts(req, res)
    expect(res.json).toHaveBeenCalledWith({ items: [] })
  })

  it('getPrompts parses query params correctly', async () => {
    const req = makeReq({ query: { tag: 'single', tags: 'a,b', source: 'src', limit: '10', offset: '5' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.VIEW)
    const getPromptsSpy = vi.spyOn(promptService, 'getPrompts').mockResolvedValue({ items: [] } as any)
    await PromptController.getPrompts(req, res)
    expect(getPromptsSpy).toHaveBeenCalledWith({ tag: 'single', tags: ['a', 'b'], source: 'src', limit: 10, offset: 5 })
    expect(res.json).toHaveBeenCalledWith({ items: [] })
  })

  it('createPrompt passes userContext ip from socket when ip missing', async () => {
    const req = makeReq({ body: { prompt: 'hi' }, user: { id: 'u1', email: 'e@b.com' }, ip: undefined, socket: { remoteAddress: '4.3.2.1' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.UPLOAD)
    const createSpy = vi.spyOn(promptService, 'createPrompt').mockResolvedValue({ id: 'p1' } as any)
    await PromptController.createPrompt(req, res)
    expect(createSpy).toHaveBeenCalled()
    const calledArgs = (createSpy as any).mock.calls[0]
    const userContext = calledArgs[2]
    expect(userContext.ip).toBe('4.3.2.1')
  })

  it('updatePrompt denies without UPLOAD permission', async () => {
    const req = makeReq({ params: { id: 'p' }, body: {} })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.VIEW)
    await PromptController.updatePrompt(req, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('deletePrompt returns 400 when id missing', async () => {
    const req = makeReq({ user: { id: 'u1' }, params: {} })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.FULL)
    await PromptController.deletePrompt(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('createPrompt denies without UPLOAD', async () => {
    const req = makeReq({ body: { prompt: 'hi' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.VIEW)
    await PromptController.createPrompt(req, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('createPrompt creates when allowed', async () => {
    const req = makeReq({ body: { prompt: 'hi' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.UPLOAD)
    vi.spyOn(promptService, 'createPrompt').mockResolvedValue({ id: 'p1' } as any)
    await PromptController.createPrompt(req, res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ id: 'p1' })
  })

  it('updatePrompt validates id and permission', async () => {
    const req = makeReq({ params: {}, body: {} })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.UPLOAD)
    await PromptController.updatePrompt(req, res)
    expect(res.status).toHaveBeenCalledWith(400)

    const req2 = makeReq({ params: { id: 'p' }, body: { prompt: 'x' } })
    const res2 = makeRes()
    vi.spyOn(promptService, 'updatePrompt').mockResolvedValue({ id: 'p' } as any)
    await PromptController.updatePrompt(req2, res2)
    expect(res2.json).toHaveBeenCalledWith({ id: 'p' })
  })

  it('deletePrompt validates and requires FULL permission', async () => {
    const req = makeReq({ user: {} })
    const res = makeRes()
    await PromptController.deletePrompt(req, res)
    expect(res.status).toHaveBeenCalledWith(401)

    const req2 = makeReq({ user: { id: 'u1' }, params: { id: 'p' } })
    const res2 = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.UPLOAD)
    await PromptController.deletePrompt(req2, res2)
    expect(res2.status).toHaveBeenCalledWith(403)

    const req3 = makeReq({ user: { id: 'u1' }, params: { id: 'p' } })
    const res3 = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.FULL)
    vi.spyOn(promptService, 'deletePrompt').mockResolvedValue(undefined)
    await PromptController.deletePrompt(req3, res3)
    expect(res3.status).toHaveBeenCalledWith(204)
  })

  it('addInteraction returns 401 when no user', async () => {
    const req = makeReq({ user: {} })
    const res = makeRes()
    await PromptController.addInteraction(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('addInteraction calls service on success', async () => {
    const req = makeReq({ user: { id: 'u1' }, body: { type: 'like' } })
    const res = makeRes()
    vi.spyOn(promptService, 'addInteraction').mockResolvedValue({ id: 'i1' } as any)
    await PromptController.addInteraction(req, res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ id: 'i1' })
  })

  it('getTags requires VIEW permission', async () => {
    const req = makeReq({ user: { id: 'u1' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.NONE)
    await PromptController.getTags(req, res)
    expect(res.status).toHaveBeenCalledWith(403)

    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.VIEW)
    vi.spyOn(promptService, 'getAllTags').mockResolvedValue([{ name: 't' } as any])
    await PromptController.getTags(req, res)
    expect(res.json).toHaveBeenCalledWith([{ name: 't' }])
  })

  it('getFeedbackCounts and getInteractions validate input and return data', async () => {
    const req = makeReq({ user: { id: 'u1' }, params: {} })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.VIEW)
    await PromptController.getFeedbackCounts(req, res)
    expect(res.status).toHaveBeenCalledWith(400)

    const req2 = makeReq({ user: { id: 'u1' }, params: { id: 'p' } })
    const res2 = makeRes()
    vi.spyOn(promptService, 'getFeedbackCounts').mockResolvedValue({ like: 1 } as any)
    await PromptController.getFeedbackCounts(req2, res2)
    expect(res2.json).toHaveBeenCalledWith({ like: 1 })

    const req3 = makeReq({ user: { id: 'u1' }, params: { id: 'p' }, query: { startDate: '2020-01-01' } })
    const res3 = makeRes()
    vi.spyOn(promptService, 'getInteractionsForPrompt').mockResolvedValue([] as any)
    await PromptController.getInteractions(req3, res3)
    expect(res3.json).toHaveBeenCalledWith([])
  })

  it('getSources and getChatSources require VIEW and return lists', async () => {
    const req = makeReq({ user: { id: 'u1' } })
    const res = makeRes()
    vi.spyOn(promptPermissionService, 'resolveUserPermission').mockResolvedValue(PermissionLevel.VIEW)
    vi.spyOn(promptService, 'getAllSources').mockResolvedValue(['a'] as any)
    vi.spyOn(promptService, 'getChatSourceNames').mockResolvedValue(['b'] as any)
    await PromptController.getSources(req, res)
    expect(res.json).toHaveBeenCalledWith(['a'])
    await PromptController.getChatSources(req, res)
    expect(res.json).toHaveBeenCalledWith(['b'])
  })
})