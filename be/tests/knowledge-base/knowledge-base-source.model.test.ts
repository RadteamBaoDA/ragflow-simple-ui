import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KnowledgeBaseSourceModel } from '../../src/modules/knowledge-base/knowledge-base-source.model.js'
import { db } from '../../src/shared/db/knex.js'

vi.mock('../../src/shared/db/knex.js', () => ({
  db: vi.fn(),
}))

describe('KnowledgeBaseSourceModel', () => {
  let model: KnowledgeBaseSourceModel
  let mockQuery: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      // Mock then to return data for result.map
      then: vi.fn(function(this: any, cb: any) { return Promise.resolve(this._results || []).then(cb) }),
      _results: []
    }
    vi.mocked(db).mockReturnValue(mockQuery)
    model = new KnowledgeBaseSourceModel()
  })

  describe('getChatSourceNames', () => {
    it('selects names where type is chat sorted alphabetically', async () => {
      mockQuery._results = [{ name: 'A' }, { name: 'B' }]
      
      const result = await model.getChatSourceNames()

      expect(mockQuery.select).toHaveBeenCalledWith('name')
      expect(mockQuery.where).toHaveBeenCalledWith('type', 'chat')
      expect(mockQuery.orderBy).toHaveBeenCalledWith('name', 'asc')
      expect(result).toEqual(['A', 'B'])
    })
  })

  describe('findByType', () => {
    it('filters by type and orders by name', async () => {
      mockQuery._results = []
      
      await model.findByType('search')

      expect(mockQuery.where).toHaveBeenCalledWith('type', 'search')
      expect(mockQuery.orderBy).toHaveBeenCalledWith('name', 'asc')
    })
  })
})
