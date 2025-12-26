/**
 * @fileoverview Tests for MinioBucketModel helpers.
 * 
 * Tests custom query methods for bucket name and IDs lookup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MinioBucketModel, CreateMinioBucketDto } from '../../src/models/minio-bucket.model.js'

const makeBuilder = (rows: any[] = []) => {
  const builder: any = {
    where: vi.fn(() => builder),
    whereIn: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    first: vi.fn(() => Promise.resolve(rows[0])),
    then: (resolve: any) => Promise.resolve(rows).then(resolve),
  }
  return builder
}

describe('MinioBucketModel', () => {
  let model: MinioBucketModel
  let builder: any
  let mockKnex: any

  const setup = (rows: any[]) => {
    builder = makeBuilder(rows)
    mockKnex = vi.fn(() => builder)
    model = new MinioBucketModel()
    ;(model as any).knex = mockKnex
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findByName', () => {
    it('should query by bucket_name and return single bucket', async () => {
      const bucket = { id: 'b1', bucket_name: 'my-bucket', description: 'Test bucket' }
      setup([bucket])

      const result = await model.findByName('my-bucket')

      expect(mockKnex).toHaveBeenCalledWith('minio_buckets')
      expect(builder.where).toHaveBeenCalledWith({ bucket_name: 'my-bucket' })
      expect(builder.first).toHaveBeenCalled()
      expect(result).toEqual(bucket)
    })

    it('should return undefined when bucket not found', async () => {
      setup([])

      const result = await model.findByName('non-existent')

      expect(mockKnex).toHaveBeenCalledWith('minio_buckets')
      expect(builder.where).toHaveBeenCalledWith({ bucket_name: 'non-existent' })
      expect(result).toBeUndefined()
    })

    it('should handle special characters in bucket name', async () => {
      const bucket = { id: 'b2', bucket_name: 'bucket-with-dashes_and_underscores' }
      setup([bucket])

      const result = await model.findByName('bucket-with-dashes_and_underscores')

      expect(builder.where).toHaveBeenCalledWith({ bucket_name: 'bucket-with-dashes_and_underscores' })
      expect(result).toEqual(bucket)
    })

    it('should handle empty string bucket name', async () => {
      setup([])

      const result = await model.findByName('')

      expect(builder.where).toHaveBeenCalledWith({ bucket_name: '' })
      expect(result).toBeUndefined()
    })
  })

  describe('findByIds', () => {
    it('should query with whereIn and order by created_at desc', async () => {
      const buckets = [
        { id: 'b1', bucket_name: 'bucket1', created_at: '2024-01-02' },
        { id: 'b2', bucket_name: 'bucket2', created_at: '2024-01-01' }
      ]
      setup(buckets)

      const result = await model.findByIds(['b1', 'b2'])

      expect(mockKnex).toHaveBeenCalledWith('minio_buckets')
      expect(builder.whereIn).toHaveBeenCalledWith('id', ['b1', 'b2'])
      expect(builder.orderBy).toHaveBeenCalledWith('created_at', 'desc')
      expect(result).toEqual(buckets)
    })

    it('should return empty array when no ids match', async () => {
      setup([])

      const result = await model.findByIds(['b999'])

      expect(mockKnex).toHaveBeenCalledWith('minio_buckets')
      expect(builder.whereIn).toHaveBeenCalledWith('id', ['b999'])
      expect(result).toEqual([])
    })

    it('should handle empty ids array', async () => {
      setup([])

      const result = await model.findByIds([])

      expect(builder.whereIn).toHaveBeenCalledWith('id', [])
      expect(result).toEqual([])
    })

    it('should handle single id in array', async () => {
      const bucket = { id: 'b1', bucket_name: 'single' }
      setup([bucket])

      const result = await model.findByIds(['b1'])

      expect(builder.whereIn).toHaveBeenCalledWith('id', ['b1'])
      expect(result).toEqual([bucket])
    })

    it('should handle multiple ids', async () => {
      const buckets = [
        { id: 'b1', bucket_name: 'first' },
        { id: 'b2', bucket_name: 'second' },
        { id: 'b3', bucket_name: 'third' }
      ]
      setup(buckets)

      const result = await model.findByIds(['b1', 'b2', 'b3'])

      expect(builder.whereIn).toHaveBeenCalledWith('id', ['b1', 'b2', 'b3'])
      expect(builder.orderBy).toHaveBeenCalledWith('created_at', 'desc')
      expect(result).toEqual(buckets)
    })

    it('should preserve order from orderBy clause', async () => {
      const buckets = [
        { id: 'b2', created_at: '2024-01-10' },
        { id: 'b1', created_at: '2024-01-05' }
      ]
      setup(buckets)

      const result = await model.findByIds(['b1', 'b2'])

      expect(builder.orderBy).toHaveBeenCalledWith('created_at', 'desc')
      expect(result[0].id).toBe('b2') // newer first
    })
  })

  describe('tableName', () => {
    it('should use minio_buckets table', () => {
      setup([])
      expect((model as any).tableName).toBe('minio_buckets')
    })
  })
})

describe('CreateMinioBucketDto', () => {
  it('should create DTO with name only', () => {
    const dto = new CreateMinioBucketDto('test-bucket')
    
    expect(dto.name).toBe('test-bucket')
    expect(dto.description).toBeUndefined()
  })

  it('should create DTO with name and description', () => {
    const dto = new CreateMinioBucketDto('test-bucket', 'Test description')
    
    expect(dto.name).toBe('test-bucket')
    expect(dto.description).toBe('Test description')
  })

  it('should handle empty description', () => {
    const dto = new CreateMinioBucketDto('test-bucket', '')
    
    expect(dto.name).toBe('test-bucket')
    expect(dto.description).toBe('')
  })

  it('should handle undefined description explicitly', () => {
    const dto = new CreateMinioBucketDto('test-bucket', undefined)
    
    expect(dto.name).toBe('test-bucket')
    expect(dto.description).toBeUndefined()
  })
})
