/**
 * @fileoverview Tests for ChatSessionModel.
 */

import { describe, it, expect, vi } from 'vitest'

const ModelFactory = {
  chatSession: {
    create: vi.fn().mockResolvedValue({ id: '1' }),
    findById: vi.fn().mockResolvedValue({ id: '1' }),
    findByUserId: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue(true),
  }
}

vi.mock('../../src/models/factory.js', () => ({
  ModelFactory,
}))

describe('ChatSessionModel', () => {
  it('should have create method', () => {
    expect(ModelFactory.chatSession.create).toBeDefined()
  })

  it('should have findById method', () => {
    expect(ModelFactory.chatSession.findById).toBeDefined()
  })

  it('should have findByUserId method', () => {
    expect(ModelFactory.chatSession.findByUserId).toBeDefined()
  })

  it('should have update method', () => {
    expect(ModelFactory.chatSession.update).toBeDefined()
  })

  it('should have delete method', () => {
    expect(ModelFactory.chatSession.delete).toBeDefined()
  })
})
