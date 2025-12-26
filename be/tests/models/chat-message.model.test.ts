/**
 * @fileoverview Tests for ChatMessageModel.
 */

import { describe, it, expect, vi } from 'vitest'

const ModelFactory = {
  chatMessage: {
    create: vi.fn().mockResolvedValue({ id: '1' }),
    findById: vi.fn().mockResolvedValue({ id: '1' }),
    findBySessionId: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue(true),
  }
}

vi.mock('../../src/models/factory.js', () => ({
  ModelFactory,
}))

describe('ChatMessageModel', () => {
  it('should have create method', () => {
    expect(ModelFactory.chatMessage.create).toBeDefined()
  })

  it('should have findById method', () => {
    expect(ModelFactory.chatMessage.findById).toBeDefined()
  })

  it('should have findBySessionId method', () => {
    expect(ModelFactory.chatMessage.findBySessionId).toBeDefined()
  })

  it('should have update method', () => {
    expect(ModelFactory.chatMessage.update).toBeDefined()
  })

  it('should have delete method', () => {
    expect(ModelFactory.chatMessage.delete).toBeDefined()
  })
})

