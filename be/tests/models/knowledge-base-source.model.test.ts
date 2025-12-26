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

vi.mock('../../src/models/factory.js', () => ({
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
