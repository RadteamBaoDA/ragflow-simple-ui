/**
 * @fileoverview Tests for StorageRawController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StorageRawController } from '../../src/controllers/storage-raw.controller.js'

const mockService = vi.hoisted(() => ({
  getGlobalStats: vi.fn(),
  listBuckets: vi.fn(),
  getBucketStats: vi.fn(),
  createBucket: vi.fn(),
  deleteBucket: vi.fn(),
  listAccessKeys: vi.fn(),
  createAccessKey: vi.fn(),
  deleteAccessKey: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('../../src/services/storage/index.js', () => ({
  storageService: mockService,
}))

vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}))

const makeRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('StorageRawController', () => {
  const controller = new StorageRawController()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Metrics & Buckets (Existing logic adapted) ---

  it('getMetrics returns global stats', async () => {
    const res = makeRes()
    mockService.getGlobalStats.mockResolvedValueOnce({ total: 100 })

    await controller.getMetrics({} as any, res)

    expect(res.json).toHaveBeenCalledWith({ total: 100 })
  })

  it('getMetrics handles errors', async () => {
    const res = makeRes()
    mockService.getGlobalStats.mockRejectedValueOnce(new Error('fail'))

    await controller.getMetrics({} as any, res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('listBuckets returns buckets', async () => {
    const res = makeRes()
    mockService.listBuckets.mockResolvedValueOnce(['b1', 'b2'])

    await controller.listBuckets({} as any, res)

    expect(res.json).toHaveBeenCalledWith({ buckets: ['b1', 'b2'] })
  })

  it('listBuckets handles errors', async () => {
    const res = makeRes()
    mockService.listBuckets.mockRejectedValueOnce(new Error('fail'))

    await controller.listBuckets({} as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getBucketStats validates missing name', async () => {
    const res = makeRes()

    await controller.getBucketStats({ params: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('getBucketStats returns stats', async () => {
    const res = makeRes()
    mockService.getBucketStats.mockResolvedValueOnce({ size: 1000 })

    await controller.getBucketStats({ params: { name: 'bucket' } } as any, res)

    expect(mockService.getBucketStats).toHaveBeenCalledWith('bucket')
    expect(res.json).toHaveBeenCalledWith({ stats: { size: 1000 } })
  })

  it('getBucketStats handles errors', async () => {
    const res = makeRes()
    mockService.getBucketStats.mockRejectedValueOnce(new Error('fail'))

    await controller.getBucketStats({ params: { name: 'bucket' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('createBucket validates missing name', async () => {
    const res = makeRes()

    await controller.createBucket({ body: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('createBucket validates invalid name format', async () => {
    const res = makeRes()

    await controller.createBucket({ body: { name: 'INVALID' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('createBucket creates and returns 201', async () => {
    const res = makeRes()

    await controller.createBucket({ body: { name: 'valid-bucket' }, user: { id: 'u1' } } as any, res)

    expect(mockService.createBucket).toHaveBeenCalledWith('valid-bucket', { id: 'u1' })
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('createBucket handles errors', async () => {
    const res = makeRes()
    mockService.createBucket.mockRejectedValueOnce(new Error('exists'))

    await controller.createBucket({ body: { name: 'bucket' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('deleteBucket validates missing name', async () => {
    const res = makeRes()

    await controller.deleteBucket({ params: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('deleteBucket deletes and returns success', async () => {
    const res = makeRes()

    await controller.deleteBucket({ params: { name: 'bucket' }, user: { id: 'u1' } } as any, res)

    expect(mockService.deleteBucket).toHaveBeenCalledWith('bucket', { id: 'u1' })
    expect(res.json).toHaveBeenCalledWith({ message: 'Bucket deleted successfully' })
  })

  it('deleteBucket handles errors', async () => {
    const res = makeRes()
    mockService.deleteBucket.mockRejectedValueOnce(new Error('not empty'))

    await controller.deleteBucket({ params: { name: 'bucket' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  // --- Access Keys (New Logic) ---

  it('listKeys returns access keys', async () => {
    const res = makeRes()
    mockService.listAccessKeys.mockResolvedValueOnce([{ accessKey: 'key1' }])

    await controller.listKeys({} as any, res)

    expect(res.json).toHaveBeenCalledWith({ keys: [{ accessKey: 'key1' }] })
  })

  it('listKeys handles errors', async () => {
    const res = makeRes()
    mockService.listAccessKeys.mockRejectedValueOnce(new Error('fail'))

    await controller.listKeys({} as any, res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('createKey creates and returns key info', async () => {
    const res = makeRes()
    const mockResult = { accessKey: 'ak', secretKey: 'sk' }
    mockService.createAccessKey.mockResolvedValueOnce(mockResult)

    await controller.createKey({ body: { policy: 'read', name: 'my-key' } } as any, res)

    expect(mockService.createAccessKey).toHaveBeenCalledWith('read', 'my-key', undefined)
    expect(res.json).toHaveBeenCalledWith(mockResult)
  })

  it('createKey handles errors', async () => {
    const res = makeRes()
    mockService.createAccessKey.mockRejectedValueOnce(new Error('fail'))

    await controller.createKey({ body: {} } as any, res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('deleteKey validates missing accessKey', async () => {
    const res = makeRes()

    await controller.deleteKey({ params: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('deleteKey deletes and returns success', async () => {
    const res = makeRes()

    await controller.deleteKey({ params: { accessKey: 'ak1' } } as any, res)

    expect(mockService.deleteAccessKey).toHaveBeenCalledWith('ak1')
    expect(res.json).toHaveBeenCalledWith({ message: 'Access key deleted successfully' })
  })

  it('deleteKey handles errors', async () => {
    const res = makeRes()
    mockService.deleteAccessKey.mockRejectedValueOnce(new Error('fail'))

    await controller.deleteKey({ params: { accessKey: 'ak1' } } as any, res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })
})
