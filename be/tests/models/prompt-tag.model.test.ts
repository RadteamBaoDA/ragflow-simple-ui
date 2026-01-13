import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PromptTagModel } from '@/models/prompt-tag.model.js'
import { db } from '@/db/knex.js'

vi.mock('@/db/knex.js', () => ({ db: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe('PromptTagModel', () => {
  let model: PromptTagModel

  beforeEach(() => {
    model = new PromptTagModel()
  })

  it('getNewestTags uses orderBy and limit', async () => {
    const limit = vi.fn().mockResolvedValue([{ id: 't1' }])
    const orderBy = vi.fn(() => ({ limit }))
    ;(db as any).mockReturnValue({ orderBy })

    const res = await model.getNewestTags(3)
    expect(orderBy).toHaveBeenCalledWith('created_at', 'desc')
    expect(limit).toHaveBeenCalledWith(3)
    expect(res).toEqual([{ id: 't1' }])
  })

  it('searchByName uses whereRaw and ordering', async () => {
    const limit = vi.fn().mockResolvedValue([{ id: 't' }])
    const orderBy = vi.fn(() => ({ limit }))
    const whereRaw = vi.fn(() => ({ orderBy }))
    ;(db as any).mockReturnValue({ whereRaw })

    const res = await model.searchByName('Abc', 2)
    expect(whereRaw).toHaveBeenCalledWith('LOWER(name) LIKE ?', ['%abc%'])
    expect(orderBy).toHaveBeenCalledWith('name', 'asc')
    expect(limit).toHaveBeenCalledWith(2)
    expect(res).toEqual([{ id: 't' }])
  })

  it('findByName returns first result', async () => {
    const first = vi.fn().mockResolvedValue({ id: 'x' })
    const whereRaw = vi.fn(() => ({ first }))
    ;(db as any).mockReturnValue({ whereRaw })

    const res = await model.findByName('Tag')
    expect(whereRaw).toHaveBeenCalledWith('LOWER(name) = ?', ['tag'])
    expect(res).toEqual({ id: 'x' })
  })

  it('findOrCreate returns existing if found', async () => {
    const existing = { id: 'e', name: 't' } as any
    vi.spyOn(model, 'findByName').mockResolvedValue(existing)

    const res = await model.findOrCreate('t', '#fff', 'u1')
    expect(res).toBe(existing)
  })

  it('findOrCreate creates when missing', async () => {
    vi.spyOn(model, 'findByName').mockResolvedValue(undefined)
    vi.spyOn(model, 'create' as any).mockResolvedValue({ id: 'new', name: 'T' } as any)

    const res = await model.findOrCreate('T', '#000', 'u1')
    expect((model.create as any)).toHaveBeenCalledWith(expect.objectContaining({ name: 'T' }))
    expect(res).toEqual({ id: 'new', name: 'T' })
  })

  it('findByIds returns empty for empty input', async () => {
    const res = await model.findByIds([])
    expect(res).toEqual([])
  })

  it('findByIds queries whereIn when ids present', async () => {
    const whereIn = vi.fn().mockResolvedValue([{ id: 'a' }])
    ;(db as any).mockReturnValue({ whereIn })

    const res = await model.findByIds(['a'])
    expect(whereIn).toHaveBeenCalledWith('id', ['a'])
    expect(res).toEqual([{ id: 'a' }])
  })

  it('findOrCreateMany returns empty for empty input', async () => {
    const res = await model.findOrCreateMany([])
    expect(res).toEqual([])
  })

  it('findOrCreateMany uses findOrCreate for each name', async () => {
    const spy = vi.spyOn(model, 'findOrCreate').mockImplementation(async (n: string) => ({ id: n, name: n }))
    const res = await model.findOrCreateMany(['a', 'b'], 'u')
    expect(spy).toHaveBeenCalledTimes(2)
    expect(res).toEqual([{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }])
  })
})