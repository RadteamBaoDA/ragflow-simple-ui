/**
 * @fileoverview Tests for DocumentPermissionModel query helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentPermissionModel } from '../../src/models/document-permission.model.js'

const makeBuilder = (rows: any[] = []) => {
  const calls: any[] = []
  const builder: any = {
    calls,
    select: vi.fn(() => builder),
    where: vi.fn((arg: any, arg2?: any) => {
      calls.push({ type: 'where', arg, arg2 })
      if (typeof arg === 'function') {
        arg(builder)
      }
      return builder
    }),
    orWhere: vi.fn((arg: any) => {
      calls.push({ type: 'orWhere', arg })
      if (typeof arg === 'function') {
        arg(builder)
      }
      return builder
    }),
    whereIn: vi.fn((col: string, vals: any[]) => {
      calls.push({ type: 'whereIn', col, vals })
      return builder
    }),
    first: vi.fn(() => Promise.resolve(rows[0])),
    then: (resolve: any) => Promise.resolve(rows).then(resolve),
  }
  return builder
}

describe('DocumentPermissionModel', () => {
  let model: DocumentPermissionModel
  let builder: any
  let mockKnex: any

  const setup = (rows: any[]) => {
    builder = makeBuilder(rows)
    mockKnex = vi.fn(() => builder)
    model = new DocumentPermissionModel()
    ;(model as any).knex = mockKnex
  }

  beforeEach(() => {
    setup([])
  })

  it('findByEntityAndBucket queries table with composite filter', async () => {
    const row = { id: 'p1', permission_level: 'view' }
    setup([row])

    const result = await model.findByEntityAndBucket('user', 'u1', 'b1')

    expect(mockKnex).toHaveBeenCalledWith('document_permissions')
    expect(builder.where).toHaveBeenCalledWith({ entity_type: 'user', entity_id: 'u1', bucket_id: 'b1' })
    expect(builder.first).toHaveBeenCalled()
    expect(result).toEqual(row)
  })

  it('findAccessibleBucketIds merges user and team buckets uniquely', async () => {
    setup([{ bucket_id: 'b1' }, { bucket_id: 'b2' }, { bucket_id: 'b1' }])

    const buckets = await model.findAccessibleBucketIds('u1', ['t1', 't2'])

    expect(builder.select).toHaveBeenCalledWith('bucket_id')
    expect(builder.orWhere).toHaveBeenCalled()
    expect(builder.whereIn).toHaveBeenCalledWith('entity_id', ['t1', 't2'])
    expect(buckets).toEqual(['b1', 'b2'])
  })

  it('findAccessibleBucketIds skips team clause when none provided', async () => {
    setup([{ bucket_id: 'b1' }])

    const buckets = await model.findAccessibleBucketIds('u1', [])

    expect(builder.orWhere).not.toHaveBeenCalled()
    expect(buckets).toEqual(['b1'])
  })
})
