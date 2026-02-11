import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GlossaryKeywordModel } from '../../src/modules/glossary/glossary-keyword.model.js'
import { db } from '../../src/shared/db/knex.js'

vi.mock('../../src/shared/db/knex.js', () => ({
  db: vi.fn(),
}))

describe('GlossaryKeywordModel', () => {
  let model: GlossaryKeywordModel
  let mockQuery: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery = {
      whereRaw: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      // Mock then to return an empty array by default
      then: vi.fn(function(this: any, cb: any) { return Promise.resolve(this._results || []).then(cb) }),
      _results: []
    }
    vi.mocked(db).mockReturnValue(mockQuery)
    model = new GlossaryKeywordModel()
  })

  describe('searchByName', () => {
    it('uses LIKE with lowercased query', async () => {
      await model.searchByName('Test')

      expect(mockQuery.whereRaw).toHaveBeenCalledWith('LOWER(name) LIKE ?', ['%test%'])
      expect(mockQuery.orderBy).toHaveBeenCalledWith('name', 'asc')
      expect(mockQuery.limit).toHaveBeenCalledWith(50)
    })
  })

  describe('findByName', () => {
    it('uses exact match with lowercased name', async () => {
      await model.findByName('Exact')

      expect(mockQuery.whereRaw).toHaveBeenCalledWith('LOWER(name) = ?', ['exact'])
      expect(mockQuery.first).toHaveBeenCalled()
    })
  })

  describe('bulkCreate', () => {
    it('skips existing keywords and inserts new ones', async () => {
      const keywords = [
        { name: 'Existing' },
        { name: 'New', en_keyword: 'NewEn', description: 'Desc' }
      ]

      // First call (Existing): find match
      mockQuery.first.mockResolvedValueOnce({ id: 'k1', name: 'Existing' })
      // Second call (New): no match
      mockQuery.first.mockResolvedValueOnce(undefined)
      // Insert for New
      mockQuery.returning.mockResolvedValueOnce([{ id: 'k2', name: 'New' }])

      const results = await model.bulkCreate(keywords, 'u1')

      expect(results).toHaveLength(2)
      expect(results[1].id).toBe('k2')
      expect(mockQuery.insert).toHaveBeenCalledTimes(1)
      expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New',
        en_keyword: 'NewEn',
        created_by: 'u1'
      }))
    })
  })

  describe('bulkInsertChunk', () => {
    it('processes rows within a transaction and dedups using seen Set', async () => {
      const rows = [
        { name: ' AlreadySeen ' }, // Should be skipped by Set
        { name: '  ' },           // Should be skipped (empty)
        { name: 'NewKeyword' }     // Should be inserted
      ]
      const seen = new Set(['alreadyseen'])

      const mockTrxQuery = vi.fn().mockReturnValue({
          whereRaw: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(undefined),
          insert: vi.fn().mockResolvedValue([1]),
      }) as any
      
      const mockTrx: any = mockTrxQuery
      mockTrx.transaction = vi.fn().mockImplementation(async (callback: any) => {
          return await callback(mockTrx)
      })

      vi.mocked(db).mockImplementation(() => mockTrx)
      vi.mocked(db).transaction = mockTrx.transaction

      const result = await model.bulkInsertChunk(rows, seen, 'u1')

      expect(result.created).toBe(1)
      expect(result.skipped).toBe(2)
      expect(seen.has('newkeyword')).toBe(true)
    })
  })
})
