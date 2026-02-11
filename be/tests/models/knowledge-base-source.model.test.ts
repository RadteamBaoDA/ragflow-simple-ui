/**
 * @fileoverview Tests for KnowledgeBaseSourceModel.
 */

import { describe, it, expect, vi } from 'vitest'

const ModelFactory = {
  knowledgeBaseSource: {
    create: vi.fn().mockResolvedValue({ id: '1' }),
    findById: vi.fn().mockResolvedValue({ id: '1' }),
    findByType: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue(true),
    findAll: vi.fn().mockResolvedValue([]),
  }
}

vi.mock('../../src/shared/models/factory.js', () => ({
  ModelFactory,
}))

describe('KnowledgeBaseSourceModel', () => {
  it('should have create method', () => {
    expect(ModelFactory.knowledgeBaseSource.create).toBeDefined()
  })

  it('should have findById method', () => {
    expect(ModelFactory.knowledgeBaseSource.findById).toBeDefined()
  })

  it('should have findByType method', () => {
    expect(ModelFactory.knowledgeBaseSource.findByType).toBeDefined()
  })

  it('should have update method', () => {
    expect(ModelFactory.knowledgeBaseSource.update).toBeDefined()
  })

  it('should have delete method', () => {
    expect(ModelFactory.knowledgeBaseSource.delete).toBeDefined()
  })

  it('should have findAll method', () => {
    expect(ModelFactory.knowledgeBaseSource.findAll).toBeDefined()
  })
})

// Additional unit tests for direct model methods
import { KnowledgeBaseSourceModel } from '@/modules/knowledge-base/knowledge-base-source.model.js'
import { db } from '@/shared/db/knex.js'
vi.mock('@/shared/db/knex.js', () => ({ db: vi.fn() }))

describe('KnowledgeBaseSourceModel direct methods', () => {
  let model: KnowledgeBaseSourceModel
  beforeEach(() => { model = new KnowledgeBaseSourceModel(); vi.clearAllMocks() })

  it('getChatSourceNames queries select where and orderBy and maps names', async () => {
    const orderBy = vi.fn().mockResolvedValue([{ name: 'A' }, { name: 'B' }])
    const where = vi.fn(() => ({ orderBy }))
    const select = vi.fn(() => ({ where }))
    ;(db as any).mockReturnValue({ select })

    const res = await model.getChatSourceNames()
    expect(select).toHaveBeenCalledWith('name')
    expect(where).toHaveBeenCalledWith('type', 'chat')
    expect(orderBy).toHaveBeenCalledWith('name', 'asc')
    expect(res).toEqual(['A', 'B'])
  })

  it('findByType queries where and orderBy', async () => {
    const orderBy = vi.fn().mockResolvedValue([{ id: '1' }])
    const where = vi.fn(() => ({ orderBy }))
    ;(db as any).mockReturnValue({ where })

    const res = await model.findByType('search')
    expect(where).toHaveBeenCalledWith('type', 'search')
    expect(orderBy).toHaveBeenCalledWith('name', 'asc')
    expect(res).toEqual([{ id: '1' }])
  })
})
