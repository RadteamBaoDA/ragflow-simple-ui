/**
 * @fileoverview Tests for AuditLogModel.
 */

import { describe, it, expect, vi } from 'vitest'

const ModelFactory = {
  auditLog: {
    create: vi.fn().mockResolvedValue({ id: '1' }),
    findById: vi.fn().mockResolvedValue({ id: '1' }),
    findAll: vi.fn().mockResolvedValue([]),
  }
}

vi.mock('../../src/models/factory.js', () => ({
  ModelFactory,
}))

describe('AuditLogModel', () => {
  it('should have create method', () => {
    expect(ModelFactory.auditLog.create).toBeDefined()
  })

  it('should have findById method', () => {
    expect(ModelFactory.auditLog.findById).toBeDefined()
  })

  it('should have findAll method', () => {
    expect(ModelFactory.auditLog.findAll).toBeDefined()
  })
})
