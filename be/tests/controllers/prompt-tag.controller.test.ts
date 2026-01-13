import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PromptTagController } from '@/controllers/prompt-tag.controller.js'
import { promptTagService } from '@/services/prompt-tag.service.js'

const makeReq = (overrides: any = {}) => ({ params: {}, query: {}, body: {}, user: { id: 'u1' }, ...overrides }) as any
const makeRes = () => { const innerJson = vi.fn(); return { status: vi.fn(() => ({ json: innerJson })), json: innerJson } as any }

describe('PromptTagController', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('getTags returns newest tags with default limit', async () => {
    const req = makeReq()
    const res = makeRes()
    vi.spyOn(promptTagService, 'getNewestTags').mockResolvedValue([{ name: 't' }])
    await PromptTagController.getTags(req, res)
    expect(res.json).toHaveBeenCalledWith([{ name: 't' }])
  })

  it('searchTags forwards query and limit', async () => {
    const req = makeReq({ query: { q: 'x', limit: '2' } })
    const res = makeRes()
    vi.spyOn(promptTagService, 'searchTags').mockResolvedValue([{ name: 'x' }])
    await PromptTagController.searchTags(req, res)
    expect(res.json).toHaveBeenCalledWith([{ name: 'x' }])
  })

  it('createTag validates name and creates', async () => {
    const reqBad = makeReq({ body: { name: '' } })
    const resBad = makeRes()
    await PromptTagController.createTag(reqBad, resBad)
    expect(resBad.status).toHaveBeenCalledWith(400)

    const req = makeReq({ body: { name: 'Tag' } })
    const res = makeRes()
    vi.spyOn(promptTagService, 'createTag').mockResolvedValue({ id: 't1' } as any)
    await PromptTagController.createTag(req, res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ id: 't1' })
  })

  it('getTagsByIds validates and returns', async () => {
    const reqBad = makeReq({ body: {} })
    const resBad = makeRes()
    await PromptTagController.getTagsByIds(reqBad, resBad)
    expect(resBad.status).toHaveBeenCalledWith(400)

    const req = makeReq({ body: { ids: ['a'] } })
    const res = makeRes()
    vi.spyOn(promptTagService, 'getTagsByIds').mockResolvedValue([{ id: 'a' }])
    await PromptTagController.getTagsByIds(req, res)
    expect(res.json).toHaveBeenCalledWith([{ id: 'a' }])
  })
})