import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Helper to create a chainable builder that resolves to `result` when awaited
function makeBuilder(result: unknown) {
  const builder: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(function (...args: any[]) {
      // If a function is provided, call it with this builder to simulate nested builders
      if (typeof args[0] === 'function') {
        // pass the builder as the first argument (Knex passes a builder to the callback)
        args[0].call(this, this)
        return this
      }
      return this
    }),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    whereRaw: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orWhereExists: vi.fn().mockImplementation(function (fn: any) { fn.call(this); return this }),
    whereIn: vi.fn().mockReturnThis(),
    delete: vi.fn().mockResolvedValue(result),
    // thenable so `await builder` returns `result`
    then: (onFulfilled: any) => Promise.resolve(result).then(onFulfilled)
  }
  return builder
} 

describe('ChatHistoryService', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('searchSessions returns sessions and total', async () => {
    const { chatHistoryService } = await import('../../src/services/chat-history.service')

    const sessions = [{ id: 's1' }, { id: 's2' }]
    const sessionBuilder = makeBuilder(sessions)
    const countBuilder: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      whereIn: vi.fn().mockReturnThis(),
      count: vi.fn().mockReturnValue({ first: () => Promise.resolve({ total: '2' }) })
    }

    const factory = await import('../../src/models/factory')
    // mutate exported ModelFactory for the test: first call -> data query; second call -> count query
    factory.ModelFactory.chatSession.getKnex = vi.fn().mockImplementationOnce(() => sessionBuilder).mockImplementationOnce(() => countBuilder)

    const res = await chatHistoryService.searchSessions('u1', 10, 0, '', '', '')
    expect(res.sessions).toEqual(sessions)
    expect(res.total).toEqual(2)
  })

  it('searchSessions applies search and date filters to both queries', async () => {
    const { chatHistoryService } = await import('../../src/services/chat-history.service')

    const sessions = [{ id: 's3' }]
    const sessionBuilder = makeBuilder(sessions)
    const countBuilder = makeBuilder({})
    countBuilder.count = vi.fn().mockReturnValue({ first: () => Promise.resolve({ total: '1' }) })

    const factory = await import('../../src/models/factory')
    factory.ModelFactory.chatSession.getKnex = vi.fn().mockImplementationOnce(() => sessionBuilder).mockImplementationOnce(() => countBuilder)

    const res = await chatHistoryService.searchSessions('u1', 5, 0, 'hello', '2020-01-01', '2020-02-01')

    expect(res.sessions).toEqual(sessions)
    expect(res.total).toBe(1)

    // ensure the nested orWhereExists added an andWhere on content ilike
    expect(sessionBuilder.andWhere).toHaveBeenCalledWith('content', 'ilike', '%hello%')
    expect(countBuilder.andWhere).toHaveBeenCalledWith('content', 'ilike', '%hello%')

    // ensure date filters applied on both queries
    expect(sessionBuilder.where).toHaveBeenCalledWith('created_at', '>=', '2020-01-01')
    expect(sessionBuilder.where).toHaveBeenCalledWith('created_at', '<=', '2020-02-01')
    expect(countBuilder.where).toHaveBeenCalledWith('created_at', '>=', '2020-01-01')
    expect(countBuilder.where).toHaveBeenCalledWith('created_at', '<=', '2020-02-01')
  })
  it('deleteSession returns true when delete count > 0', async () => {
    const { chatHistoryService } = await import('../../src/services/chat-history.service')
    const builder = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), delete: vi.fn().mockResolvedValue(1) }
    const factory = await import('../../src/models/factory')
    factory.ModelFactory.chatSession.getKnex = vi.fn().mockReturnValue(builder)

    const ok = await chatHistoryService.deleteSession('u1', 's1')
    expect(ok).toBe(true)
  })

  it('deleteSession returns false when delete count is 0', async () => {
    const { chatHistoryService } = await import('../../src/services/chat-history.service')
    const builder = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), delete: vi.fn().mockResolvedValue(0) }
    const factory = await import('../../src/models/factory')
    factory.ModelFactory.chatSession.getKnex = vi.fn().mockReturnValue(builder)

    const ok = await chatHistoryService.deleteSession('u1', 's1')
    expect(ok).toBe(false)
  })

  it('deleteSessions deletes all when all=true', async () => {
    const { chatHistoryService } = await import('../../src/services/chat-history.service')
    const builder = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), delete: vi.fn().mockResolvedValue(5) }
    const factory = await import('../../src/models/factory')
    factory.ModelFactory.chatSession.getKnex = vi.fn().mockReturnValue(builder)

    const count = await chatHistoryService.deleteSessions('u1', [], true)
    expect(count).toBe(5)
  })

  it('deleteSessions deletes by ids when provided', async () => {
    const { chatHistoryService } = await import('../../src/services/chat-history.service')
    const builder = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), whereIn: vi.fn().mockReturnThis(), delete: vi.fn().mockResolvedValue(2) }
    const factory = await import('../../src/models/factory')
    factory.ModelFactory.chatSession.getKnex = vi.fn().mockReturnValue(builder)

    const count = await chatHistoryService.deleteSessions('u1', ['a','b'], false)
    expect(count).toBe(2)
  })

  it('deleteSessions returns 0 when no ids and all=false', async () => {
    const { chatHistoryService } = await import('../../src/services/chat-history.service')
    const builder = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), delete: vi.fn().mockResolvedValue(0) }
    const factory = await import('../../src/models/factory')
    factory.ModelFactory.chatSession.getKnex = vi.fn().mockReturnValue(builder)

    const count = await chatHistoryService.deleteSessions('u1', [], false)
    expect(count).toBe(0)
  })
})