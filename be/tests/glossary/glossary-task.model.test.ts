import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GlossaryTaskModel } from '../../src/modules/glossary/glossary-task.model.js'
import { db } from '../../src/shared/db/knex.js'

vi.mock('../../src/shared/db/knex.js', () => ({
  db: vi.fn(),
}))

describe('GlossaryTaskModel', () => {
  let model: GlossaryTaskModel
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
      then: vi.fn(function(this: any, cb: any) { return Promise.resolve(this._results || []).then(cb) }),
      _results: []
    }
    vi.mocked(db).mockReturnValue(mockQuery)
    model = new GlossaryTaskModel()
  })

  describe('searchByName', () => {
    it('uses LIKE and orders by sort_order and name', async () => {
      await model.searchByName('Task')

      expect(mockQuery.whereRaw).toHaveBeenCalledWith('LOWER(name) LIKE ?', ['%task%'])
      expect(mockQuery.orderBy).toHaveBeenCalledWith('sort_order', 'asc')
      expect(mockQuery.orderBy).toHaveBeenCalledWith('name', 'asc')
    })
  })

  describe('findByName', () => {
    it('uses exact match', async () => {
      await model.findByName('Exact Task')
      expect(mockQuery.whereRaw).toHaveBeenCalledWith('LOWER(name) = ?', ['exact task'])
    })
  })

  describe('findOrCreate', () => {
    it('returns existing task if found', async () => {
      const existingTask = { id: 't1', name: 'Existing' }
      mockQuery.first.mockResolvedValueOnce(existingTask)
      
      const result = await model.findOrCreate('Existing', 'inst', 'template')

      expect(result).toEqual(existingTask)
    })

    it('creates new task if not found', async () => {
      mockQuery.first.mockResolvedValueOnce(undefined)
      const createdTask = { id: 't2', name: 'New' }
      mockQuery.returning.mockResolvedValueOnce([createdTask])

      const result = await model.findOrCreate('New', 'inst', 'template', 'u1')

      expect(result.id).toBe('t2')
      expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New',
        task_instruction_en: 'inst',
        context_template: 'template'
      }))
    })
  })

  describe('bulkInsertChunk', () => {
    it('deduplicates and inserts tasks in transaction', async () => {
      const rows = [
        { task_name: 'Task 1', task_instruction_en: 'i1', context_template: 't1' },
        { task_name: 'Task 1', task_instruction_en: 'i2', context_template: 't2' } // Duplicate in rows
      ]
      const seen = new Set<string>()

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
      expect(result.skipped).toBe(1)
    })
  })
})
