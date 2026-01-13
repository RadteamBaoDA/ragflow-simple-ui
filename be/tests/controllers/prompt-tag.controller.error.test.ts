import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PromptTagController } from '@/controllers/prompt-tag.controller.js'
import { promptTagService } from '@/services/prompt-tag.service.js'

const makeReq = (overrides: any = {}) => ({ params: {}, query: {}, body: {}, user: { id: 'u1' }, ...overrides }) as any
const makeRes = () => { const innerJson = vi.fn(); return { status: vi.fn(() => ({ json: innerJson })), json: innerJson } as any }

describe('PromptTagController error branches', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('getTags returns 500 when service throws', async () => {
    const req = makeReq()
    const res = makeRes()
    vi.spyOn(promptTagService, 'getNewestTags').mockRejectedValueOnce(new Error('boom'))
    await PromptTagController.getTags(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('searchTags returns 500 when service throws', async () => {
    const req = makeReq({ query: { q: 'x', limit: '2' } })
    const res = makeRes()
    vi.spyOn(promptTagService, 'searchTags').mockRejectedValueOnce(new Error('boom'))
    await PromptTagController.searchTags(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('createTag returns 500 when service throws', async () => {
    const req = makeReq({ body: { name: 'Tag' } })
    const res = makeRes()
    vi.spyOn(promptTagService, 'createTag').mockRejectedValueOnce(new Error('boom'))
    await PromptTagController.createTag(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getTagsByIds returns 500 when service throws', async () => {
    const req = makeReq({ body: { ids: ['a'] } })
    const res = makeRes()
    vi.spyOn(promptTagService, 'getTagsByIds').mockRejectedValueOnce(new Error('boom'))
    await PromptTagController.getTagsByIds(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})