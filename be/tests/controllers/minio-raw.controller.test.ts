/**
 * @fileoverview Tests for MinioRawController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MinioRawController } from '../../src/controllers/minio-raw.controller.js'

const mockService = vi.hoisted(() => ({
  getGlobalStats: vi.fn(),
  listBuckets: vi.fn(),
  getBucketStats: vi.fn(),
  createBucket: vi.fn(),
  deleteBucket: vi.fn(),
  listServiceAccounts: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('../../src/services/minio.service.js', () => ({
  minioService: mockService,
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

describe('MinioRawController', () => {
  const controller = new MinioRawController()

  beforeEach(() => {
    vi.clearAllMocks()
  })

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

    await controller.createBucket({ body: { name: 'valid-bucket' } } as any, res)

    expect(mockService.createBucket).toHaveBeenCalledWith('valid-bucket', '', undefined)
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

    await controller.deleteBucket({ params: { name: 'bucket' } } as any, res)

    expect(mockService.deleteBucket).toHaveBeenCalledWith('bucket')
    expect(res.json).toHaveBeenCalledWith({ message: 'Bucket deleted successfully' })
  })

  it('deleteBucket handles errors', async () => {
    const res = makeRes()
    mockService.deleteBucket.mockRejectedValueOnce(new Error('not empty'))

    await controller.deleteBucket({ params: { name: 'bucket' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('listKeys returns service accounts', async () => {
    const res = makeRes()
    mockService.listServiceAccounts.mockResolvedValueOnce([{ id: 'key1' }])

    await controller.listKeys({} as any, res)

    expect(res.json).toHaveBeenCalledWith({ keys: [{ id: 'key1' }] })
  })

  it('listKeys handles errors', async () => {
    const res = makeRes()
    mockService.listServiceAccounts.mockRejectedValueOnce(new Error('fail'))

    await controller.listKeys({} as any, res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })
})
