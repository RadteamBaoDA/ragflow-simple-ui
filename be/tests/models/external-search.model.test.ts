import { describe, it, expect, vi } from 'vitest'
import { ExternalSearchHistoryModel } from '@/modules/external/models/search-history.model.js'
import { ExternalSearchRecordModel } from '@/modules/external/models/search-record.model.js'
import { ExternalSearchSessionModel } from '@/modules/external/models/search-session.model.js'

function makeBuilder(result: unknown) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    join: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(function (arg: any) {
      if (typeof arg === 'function') { arg.call(this, this); return this }
      return this
    }),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    whereExists: vi.fn().mockImplementation(function(fn: any){ fn.call(this); return this }),
    whereRaw: vi.fn().mockReturnThis(),
    orWhereRaw: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((cb: any) => Promise.resolve(result).then(cb)),
  }
  return builder
}

describe('External search models', () => {
  it('ExternalSearchHistoryModel has proper tableName', () => {
    const m = new ExternalSearchHistoryModel()
    expect((m as any).tableName).toBe('external_search_history')
  })

  it('ExternalSearchRecordModel.findBySessionIdAndUserEmail builds query', async () => {
    const m = new ExternalSearchRecordModel()
    const rows = [{ id: 'r1' }]
    const builder = makeBuilder(rows)
    m.knex = builder

    const res = await m.findBySessionIdAndUserEmail('s1', 'u@e')
    expect(res).toEqual(rows)
    expect(builder.where).toHaveBeenCalledWith('external_search_records.session_id', 's1')
    expect(builder.andWhere).toHaveBeenCalledWith('external_search_sessions.user_email', 'u@e')
  })

  it('ExternalSearchSessionModel.findHistoryByUser applies filters and search', async () => {
    const m = new ExternalSearchSessionModel()
    const rows = [{ session_id: 's1' }]
    const builder = makeBuilder(rows)
    // ensure leftJoin and raw available
    builder.leftJoin = vi.fn().mockReturnThis()
    builder.client = { raw: vi.fn().mockReturnThis() }

    m.knex = builder

    const res = await m.findHistoryByUser('u@e', 10, 0, 'term', '2020-01-01', '2020-01-02')
    expect(res).toEqual(rows)
    // date filters applied
    expect(builder.where).toHaveBeenCalledWith('external_search_sessions.updated_at', '>=', '2020-01-01')
    expect(builder.where).toHaveBeenCalledWith('external_search_sessions.updated_at', '<=', '2020-01-02 23:59:59')
    // search should trigger whereRaw/orWhereRaw calls inside subquery
    expect(builder.whereRaw).toHaveBeenCalled()
    expect(builder.orWhereRaw).toHaveBeenCalled()
  })
})