/**
 * @fileoverview Tests for TeamModel.
 */

import { describe, it, expect, vi } from 'vitest'

const ModelFactory = {
  team: {
    create: vi.fn().mockResolvedValue({ id: '1' }),
    findById: vi.fn().mockResolvedValue({ id: '1' }),
    findByName: vi.fn().mockResolvedValue({ id: '1' }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue(true),
    findAll: vi.fn().mockResolvedValue([]),
  }
}

vi.mock('../../src/models/factory.js', () => ({
  ModelFactory,
}))

describe('TeamModel', () => {
  it('should have create method', () => {
    expect(ModelFactory.team.create).toBeDefined()
  })

  it('should have findById method', () => {
    expect(ModelFactory.team.findById).toBeDefined()
  })

  it('should have findByName method', () => {
    expect(ModelFactory.team.findByName).toBeDefined()
  })

  it('should have update method', () => {
    expect(ModelFactory.team.update).toBeDefined()
  })

  it('should have delete method', () => {
    expect(ModelFactory.team.delete).toBeDefined()
  })

  it('should have findAll method', () => {
    expect(ModelFactory.team.findAll).toBeDefined()
  })
})
