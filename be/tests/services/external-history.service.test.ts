import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('ExternalHistoryService', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('saveChatHistory creates session and message within transaction', async () => {
    const { externalHistoryService } = await import('../../src/modules/external/external-history.service')
    const { db } = await import('../../src/shared/db/knex')
    const factory = await import('../../src/shared/models/factory')
    const { log } = await import('../../src/shared/services/logger.service')

    // fake trx object
    const trx: any = { id: 'trx1' }

    // stub db.transaction to call callback with trx
    vi.spyOn(db, 'transaction' as any).mockImplementation(async (fn: any) => {
      return fn(trx)
    })

    // session builder: transacting().insert().onConflict(...).merge()
    const sessionBuilder: any = {
      transacting: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnValue({ onConflict: (col: string) => ({ merge: vi.fn().mockResolvedValue(undefined) }) }),
    }

    factory.ModelFactory.externalChatSession.getKnex = vi.fn().mockReturnValue(sessionBuilder)

    // mock externalChatMessage.create
    factory.ModelFactory.externalChatMessage.create = vi.fn().mockResolvedValue(undefined)

    const spyDebug = vi.spyOn(log, 'debug')
    const spyError = vi.spyOn(log, 'error')

    const data = {
      session_id: 's1',
      share_id: 'sh1',
      user_email: 'u@test',
      user_prompt: 'hello',
      llm_response: 'world',
      citations: [{ a: 1 }]
    }

    await externalHistoryService.saveChatHistory(data as any)

    expect(factory.ModelFactory.externalChatSession.getKnex).toHaveBeenCalled()
    expect(sessionBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ session_id: 's1', share_id: 'sh1', user_email: 'u@test' }))
    expect(factory.ModelFactory.externalChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ user_prompt: 'hello', llm_response: 'world', citations: JSON.stringify(data.citations) }), trx)
    expect(spyDebug).toHaveBeenCalledWith(expect.stringContaining('Starting transaction for chat history session s1'))
    expect(spyDebug).toHaveBeenCalledWith(expect.stringContaining('Successfully saved chat history for session s1'))
    expect(spyError).not.toHaveBeenCalled()
  })

  it('saveChatHistory logs error and rethrows when create fails', async () => {
    const { externalHistoryService } = await import('../../src/modules/external/external-history.service')
    const { db } = await import('../../src/shared/db/knex')
    const factory = await import('../../src/shared/models/factory')
    const { log } = await import('../../src/shared/services/logger.service')

    const trx: any = { id: 'trx2' }
    vi.spyOn(db, 'transaction' as any).mockImplementation(async (fn: any) => {
      return fn(trx)
    })

    const sessionBuilder: any = { transacting: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnValue({ onConflict: (col: string) => ({ merge: vi.fn().mockResolvedValue(undefined) }) }) }
    factory.ModelFactory.externalChatSession.getKnex = vi.fn().mockReturnValue(sessionBuilder)

    // make create throw
    factory.ModelFactory.externalChatMessage.create = vi.fn().mockRejectedValue(new Error('boom'))

    const spyError = vi.spyOn(log, 'error')

    await expect(externalHistoryService.saveChatHistory({ session_id: 's2', user_prompt: 'x', llm_response: 'y', citations: [] } as any)).rejects.toThrow('boom')
    expect(spyError).toHaveBeenCalledWith(expect.stringContaining('Failed to save chat history for session s2'), expect.any(Object))
  })

  it('saveSearchHistory creates session and record and uses fallback session_id', async () => {
    const { externalHistoryService } = await import('../../src/modules/external/external-history.service')
    const { db } = await import('../../src/shared/db/knex')
    const factory = await import('../../src/shared/models/factory')
    const { log } = await import('../../src/shared/services/logger.service')

    // control Date.now to ensure deterministic session id
    vi.spyOn(Date, 'now').mockReturnValue(12345 as any)

    const trx: any = { id: 'trx3' }
    vi.spyOn(db, 'transaction' as any).mockImplementation(async (fn: any) => {
      return fn(trx)
    })

    const sessionBuilder: any = { transacting: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnValue({ onConflict: (col: string) => ({ merge: vi.fn().mockResolvedValue(undefined) }) }) }
    factory.ModelFactory.externalSearchSession.getKnex = vi.fn().mockReturnValue(sessionBuilder)

    let captured: any = null
    factory.ModelFactory.externalSearchRecord.create = vi.fn().mockImplementation((payload: any) => { captured = payload; return Promise.resolve(undefined) })

    const spyDebug = vi.spyOn(log, 'debug')

    await externalHistoryService.saveSearchHistory({ search_input: 'q', ai_summary: 's', file_results: [] } as any)

    expect(factory.ModelFactory.externalSearchSession.getKnex).toHaveBeenCalled()
    expect(captured.session_id).toBe('search-12345')
    expect(factory.ModelFactory.externalSearchRecord.create).toHaveBeenCalledWith(expect.objectContaining({ search_input: 'q', ai_summary: 's', file_results: JSON.stringify([]) }), trx)
    expect(spyDebug).toHaveBeenCalledWith(expect.stringContaining('Successfully saved search history'))
  })

  it('saveSearchHistory logs error and rethrows when record create fails', async () => {
    const { externalHistoryService } = await import('../../src/modules/external/external-history.service')
    const { db } = await import('../../src/shared/db/knex')
    const factory = await import('../../src/shared/models/factory')
    const { log } = await import('../../src/shared/services/logger.service')

    const trx: any = { id: 'trx4' }
    vi.spyOn(db, 'transaction' as any).mockImplementation(async (fn: any) => {
      return fn(trx)
    })

    const sessionBuilder: any = { transacting: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnValue({ onConflict: (col: string) => ({ merge: vi.fn().mockResolvedValue(undefined) }) }) }
    factory.ModelFactory.externalSearchSession.getKnex = vi.fn().mockReturnValue(sessionBuilder)

    factory.ModelFactory.externalSearchRecord.create = vi.fn().mockRejectedValue(new Error('boom2'))

    const spyError = vi.spyOn(log, 'error')

    await expect(externalHistoryService.saveSearchHistory({ session_id: 's4', search_input: 'x', ai_summary: 'y', file_results: [] } as any)).rejects.toThrow('boom2')
    expect(spyError).toHaveBeenCalledWith(expect.stringContaining('Failed to save search history'), expect.any(Object))
  })
})