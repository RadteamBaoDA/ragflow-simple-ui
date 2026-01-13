import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/db/knex.js', () => {
  const fn: any = vi.fn()
  fn.raw = vi.fn((sql: string) => sql)
  return { db: fn }
})

import { PromptInteractionModel } from '@/models/prompt-interaction.model.js'
import { db } from '@/db/knex.js'

let model: PromptInteractionModel

beforeEach(() => {
  vi.clearAllMocks()
  model = new PromptInteractionModel()
})

describe('PromptInteractionModel', () => {
  it('getFeedbackCounts returns parsed counts when present', async () => {
    const first = vi.fn().mockResolvedValue({ like_count: '2', dislike_count: '1' })
    const select = vi.fn().mockReturnValue({ first })
    const where = vi.fn().mockReturnValue({ select })
    ;(db as any).mockReturnValue({ where })

    const res = await model.getFeedbackCounts('p1')

    expect(where).toHaveBeenCalledWith('prompt_id', 'p1')
    expect(res).toEqual({ like_count: 2, dislike_count: 1 })
  })

  it('getFeedbackCounts returns zeros when no result', async () => {
    const first = vi.fn().mockResolvedValue(undefined)
    const select = vi.fn().mockReturnValue({ first })
    const where = vi.fn().mockReturnValue({ select })
    ;(db as any).mockReturnValue({ where })

    const res = await model.getFeedbackCounts('p1')
    expect(res).toEqual({ like_count: 0, dislike_count: 0 })
  })

  it('getInteractionsWithUser returns rows and honors date filters', async () => {
    const mockRows = [{ id: 'i1', user_email: 'a@b.com', created_at: '2024-01-01' }]

    const orderBy = vi.fn().mockResolvedValue(mockRows)
    // where should be chainable and record calls
    const where = vi.fn(function (this: any, ...args: any[]) {
      return this
    })
    const leftJoin = vi.fn().mockReturnThis()
    const select = vi.fn().mockReturnThis()

    ;(db as any).mockReturnValue({ leftJoin, where, select, orderBy })

    const res = await model.getInteractionsWithUser('p1')
    expect(leftJoin).toHaveBeenCalledWith('users as u', 'pi.user_id', 'u.id')
    expect(where).toHaveBeenCalled() // called with prompt id filter at minimum
    expect(orderBy).toHaveBeenCalledWith('pi.created_at', 'desc')
    expect(res).toEqual(mockRows)

    // now test with date filters
    vi.clearAllMocks()
    const whereCalls: any[] = []
    const builder: any = {}
    builder.leftJoin = vi.fn().mockReturnThis()
    builder.where = vi.fn(function (this: any, ...args: any[]) { whereCalls.push(args); return this })
    builder.select = vi.fn().mockReturnThis()
    builder.orderBy = vi.fn().mockReturnThis()
    // make the builder thenable so awaiting returns our mockRows
    builder.then = function (resolve: any) { return Promise.resolve(mockRows).then(resolve) }
    ;(db as any).mockReturnValue(builder)

    const res2 = await model.getInteractionsWithUser('p1', '2024-01-01', '2024-01-31')
    // first call is prompt_id; subsequent calls are for start and end date
    expect(builder.where).toHaveBeenCalled()
    expect(whereCalls.some(c => c[0] === 'pi.created_at' && c[1] === '>=' && c[2] === '2024-01-01')).toBeTruthy()
    expect(whereCalls.some(c => c[0] === 'pi.created_at' && c[1] === '<=' && c[2] === '2024-01-31')).toBeTruthy()
    expect(res2).toEqual(mockRows)
  })

  it('findByUserId queries and orders', async () => {
    const orderBy = vi.fn().mockResolvedValue([{ id: 'x' }])
    const where = vi.fn().mockReturnValue({ orderBy })
    ;(db as any).mockReturnValue({ where })

    const res = await model.findByUserId('u1')
    expect(where).toHaveBeenCalledWith('user_id', 'u1')
    expect(res).toEqual([{ id: 'x' }])
  })

  it('findByPromptId queries and orders', async () => {
    const orderBy = vi.fn().mockResolvedValue([{ id: 'y' }])
    const where = vi.fn().mockReturnValue({ orderBy })
    ;(db as any).mockReturnValue({ where })

    const res = await model.findByPromptId('p1')
    expect(where).toHaveBeenCalledWith('prompt_id', 'p1')
    expect(res).toEqual([{ id: 'y' }])
  })
})