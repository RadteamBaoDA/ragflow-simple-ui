import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExternalChatHistoryModel } from '@/models/external/chat-history.model.js'

describe('ExternalChatHistoryModel', () => {
  let model: ExternalChatHistoryModel
  let mockKnex: any
  let mockQuery: any

  const createMockQuery = () => ({
    insert: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(undefined),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockResolvedValue(undefined),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    then: vi.fn((cb: any) => Promise.resolve([]).then(cb)),
  })

  beforeEach(() => {
    mockQuery = createMockQuery()
    mockKnex = vi.fn(() => mockQuery)
    model = new ExternalChatHistoryModel()
    // inject mockKnex instance for deterministic test behaviour
    ;(model as any).knex = mockKnex
  })

  it('has correct table name and knex', () => {
    expect((model as any).tableName).toBe('external_chat_history')
    expect((model as any).knex).toBe(mockKnex)
  })

  it('create inserts and returns created record', async () => {
    const data = { user_prompt: 'hi' }
    const created = { id: '1', ...data }
    mockQuery.returning.mockResolvedValue([created])

    const res = await model.create(data as any)

    expect(mockKnex).toHaveBeenCalledWith('external_chat_history')
    expect(mockQuery.insert).toHaveBeenCalledWith(data)
    expect(mockQuery.returning).toHaveBeenCalledWith('*')
    expect(res).toEqual(created)
  })

  it('findById delegates to knex and returns first result', async () => {
    const rec = { id: 'abc' }
    mockQuery.first.mockResolvedValue(rec)

    const res = await model.findById('abc')

    expect(mockKnex).toHaveBeenCalledWith('external_chat_history')
    expect(mockQuery.where).toHaveBeenCalledWith({ id: 'abc' })
    expect(mockQuery.first).toHaveBeenCalled()
    expect(res).toEqual(rec)
  })

  it('findAll returns results and applies options', async () => {
    const records = [{ id: '1' }, { id: '2' }]
    mockQuery.then.mockImplementation((cb: any) => Promise.resolve(records).then(cb))

    const res = await model.findAll()
    expect(mockKnex).toHaveBeenCalledWith('external_chat_history')
    expect(res).toEqual(records)

    // apply orderBy string
    mockQuery.then.mockImplementation((cb: any) => Promise.resolve([]).then(cb))
    await model.findAll({}, { orderBy: 'created_at' })
    expect(mockQuery.orderBy).toHaveBeenCalledWith('created_at')

    // apply object orderBy
    await model.findAll({}, { orderBy: { created_at: 'desc', user_email: 'asc' } })
    expect(mockQuery.orderBy).toHaveBeenCalledWith('created_at', 'desc')
    expect(mockQuery.orderBy).toHaveBeenCalledWith('user_email', 'asc')

    // apply limit and offset
    await model.findAll({}, { limit: 5, offset: 10 })
    expect(mockQuery.limit).toHaveBeenCalledWith(5)
    expect(mockQuery.offset).toHaveBeenCalledWith(10)
  })

  it('update updates by id or filter and returns updated', async () => {
    const updated = { id: '1', user_prompt: 'updated' }
    mockQuery.returning.mockResolvedValue([updated])

    const res1 = await model.update('1', { user_prompt: 'updated' } as any)
    expect(mockQuery.where).toHaveBeenCalledWith({ id: '1' })
    expect(mockQuery.update).toHaveBeenCalledWith({ user_prompt: 'updated' })
    expect(res1).toEqual(updated)

    // by filter object
    const filter = { user_email: 'a@b.com' }
    const res2 = await model.update(filter as any, { user_prompt: 'u' } as any)
    expect(mockQuery.where).toHaveBeenCalledWith(filter)
    expect(mockQuery.update).toHaveBeenCalledWith({ user_prompt: 'u' })
  })

  it('delete removes by id or filter', async () => {
    await model.delete('1')
    expect(mockQuery.where).toHaveBeenCalledWith({ id: '1' })
    expect(mockQuery.delete).toHaveBeenCalled()

    const filter = { user_email: 'a@b.com' }
    await model.delete(filter as any)
    expect(mockQuery.where).toHaveBeenCalledWith(filter)
  })

  it('getKnex returns a query builder', () => {
    const qb = model.getKnex()
    expect(mockKnex).toHaveBeenCalledWith('external_chat_history')
    expect(qb).toBe(mockQuery)
  })
})