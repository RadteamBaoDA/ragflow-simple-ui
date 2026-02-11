import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserHistoryController } from '@/modules/user-history/user-history.controller.js'
import { userHistoryService } from '@/modules/user-history/user-history.service.js'

const makeReq = (overrides: any = {}) => ({ params: {}, query: {}, user: { email: 'u@x' }, ...overrides }) as any
const makeRes = () => ({ status: vi.fn(() => ({ json: vi.fn() })), json: vi.fn() } as any)

describe('UserHistoryController', () => {
  let c: UserHistoryController
  beforeEach(() => { c = new UserHistoryController(); vi.restoreAllMocks() })

  it('getChatHistory requires authentication and returns data', async () => {
    const req = makeReq({ user: undefined })
    const res = makeRes()
    const next = vi.fn()
    await c.getChatHistory(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)

    const req2 = makeReq({ query: { page: '1', limit: '10' }, user: { email: 'u@x' } })
    const res2 = makeRes()
    vi.spyOn(userHistoryService, 'getChatHistory').mockResolvedValue({ items: [] } as any)
    await c.getChatHistory(req2, res2, next)
    expect(res2.json).toHaveBeenCalledWith({ items: [] })
  })

  it('getChatSessionDetails validates session id and returns details', async () => {
    const req = makeReq({ user: undefined })
    const res = makeRes()
    const next = vi.fn()
    await c.getChatSessionDetails(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)

    const req2 = makeReq({ user: { email: 'u@x' }, params: {} })
    const res2 = makeRes()
    await c.getChatSessionDetails(req2, res2, next)
    expect(res2.status).toHaveBeenCalledWith(400)

    const req3 = makeReq({ user: { email: 'u@x' }, params: { sessionId: 's1' } })
    const res3 = makeRes()
    vi.spyOn(userHistoryService, 'getChatSessionDetails').mockResolvedValue({ id: 's1' } as any)
    await c.getChatSessionDetails(req3, res3, next)
    expect(res3.json).toHaveBeenCalledWith({ id: 's1' })
  })

  it('getSearchHistory and getSearchSessionDetails behave similarly', async () => {
    const c = new UserHistoryController()
    const req = makeReq({ user: undefined })
    const res = makeRes()
    const next = vi.fn()
    await c.getSearchHistory(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)

    const req2 = makeReq({ user: { email: 'u@x' }, query: { q: 'x' } })
    const res2 = makeRes()
    vi.spyOn(userHistoryService, 'getSearchHistory').mockResolvedValue({ items: [] } as any)
    await c.getSearchHistory(req2, res2, next)
    expect(res2.json).toHaveBeenCalledWith({ items: [] })

    const req3 = makeReq({ user: { email: 'u@x' }, params: { sessionId: 's' } })
    const res3 = makeRes()
    vi.spyOn(userHistoryService, 'getSearchSessionDetails').mockResolvedValue({ id: 's' } as any)
    await c.getSearchSessionDetails(req3, res3, next)
    expect(res3.json).toHaveBeenCalledWith({ id: 's' })
  })
})