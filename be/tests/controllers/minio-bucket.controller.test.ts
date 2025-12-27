/**
 * @fileoverview Tests for MinioBucketController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MinioBucketController } from '../../src/controllers/minio-bucket.controller.js'

const mockMinioBucket = vi.hoisted(() => ({
  findAll: vi.fn(),
  findByIds: vi.fn(),
}))

const mockUserTeam = vi.hoisted(() => ({
  findTeamsByUserId: vi.fn(),
}))

const mockDocumentPermission = vi.hoisted(() => ({
  findAccessibleBucketIds: vi.fn(),
}))

const mockMinioService = vi.hoisted(() => ({
  getAvailableBuckets: vi.fn(),
  createBucket: vi.fn(),
  deleteBucket: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('../../src/models/factory.js', () => ({
  ModelFactory: {
    minioBucket: mockMinioBucket,
    userTeam: mockUserTeam,
    documentPermission: mockDocumentPermission,
  },
}))

vi.mock('../../src/services/minio.service.js', () => ({
  minioService: mockMinioService,
}))

vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}))

const makeRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.send = vi.fn(() => res)
  return res
}

const makeReq = (override: Record<string, any> = {}) => ({ headers: {}, socket: { remoteAddress: '1.1.1.1' }, ...override })

describe('MinioBucketController', () => {
  const controller = new MinioBucketController()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getBuckets returns 401 when unauthenticated', async () => {
    const res = makeRes()

    await controller.getBuckets(makeReq(), res)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('getBuckets returns all buckets for admin/global access', async () => {
    const res = makeRes()
    mockMinioBucket.findAll.mockResolvedValueOnce([{ name: 'b1' }])

    await controller.getBuckets(makeReq({ user: { id: 'u', role: 'admin', permissions: [] } }), res)

    expect(mockMinioBucket.findAll).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ buckets: [{ name: 'b1' }] })
  })

  it('getBuckets returns granted buckets for regular user', async () => {
    const res = makeRes()
    mockUserTeam.findTeamsByUserId.mockResolvedValueOnce(['t1'])
    mockDocumentPermission.findAccessibleBucketIds.mockResolvedValueOnce(['b1'])
    mockMinioBucket.findByIds.mockResolvedValueOnce([{ name: 'b1' }])

    await controller.getBuckets(makeReq({ user: { id: 'u', role: 'user', permissions: [] } }), res)

    expect(mockUserTeam.findTeamsByUserId).toHaveBeenCalledWith('u')
    expect(mockDocumentPermission.findAccessibleBucketIds).toHaveBeenCalledWith('u', ['t1'])
    expect(mockMinioBucket.findByIds).toHaveBeenCalledWith(['b1'])
    expect(res.json).toHaveBeenCalledWith({ buckets: [{ name: 'b1' }] })
  })

  it('getBuckets handles errors', async () => {
    const res = makeRes()
    mockMinioBucket.findAll.mockRejectedValueOnce(new Error('fail'))

    await controller.getBuckets(makeReq({ user: { id: 'u', role: 'admin', permissions: [] } }), res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getAvailableBuckets returns list', async () => {
    const res = makeRes()
    mockMinioService.getAvailableBuckets.mockResolvedValueOnce(['a', 'b'])

    await controller.getAvailableBuckets(makeReq(), res)

    expect(res.json).toHaveBeenCalledWith({ buckets: ['a', 'b'] })
  })

  it('getAvailableBuckets handles errors', async () => {
    const res = makeRes()
    mockMinioService.getAvailableBuckets.mockRejectedValueOnce(new Error('fail'))

    await controller.getAvailableBuckets(makeReq(), res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(mockLog.error).toHaveBeenCalled()
  })

  it('createBucket creates and returns 201', async () => {
    const res = makeRes()
    mockMinioService.createBucket.mockResolvedValueOnce({ name: 'b1' })

    await controller.createBucket(makeReq({ body: { bucket_name: 'b1', description: 'd' }, user: { id: 'u', email: 'e' } }), res)

    expect(mockMinioService.createBucket).toHaveBeenCalledWith('b1', 'd', expect.any(Object))
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ bucket: { name: 'b1' } })
  })

  it('createBucket handles errors', async () => {
    const res = makeRes()
    mockMinioService.createBucket.mockRejectedValueOnce(new Error('boom'))

    await controller.createBucket(makeReq({ body: { bucket_name: 'b1', description: 'd' }, user: { id: 'u', email: 'e' } }), res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(mockLog.error).toHaveBeenCalled()
  })

  it('deleteBucket validates missing name', async () => {
    const res = makeRes()

    await controller.deleteBucket(makeReq({ params: {} }), res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('deleteBucket deletes and returns 204', async () => {
    const res = makeRes()

    await controller.deleteBucket(makeReq({ params: { name: 'bucket' }, user: { id: 'u', email: 'e' } }), res)

    expect(mockMinioService.deleteBucket).toHaveBeenCalledWith('bucket', expect.any(Object))
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('deleteBucket handles errors', async () => {
    const res = makeRes()
    mockMinioService.deleteBucket.mockRejectedValueOnce(new Error('fail'))

    await controller.deleteBucket(makeReq({ params: { name: 'bucket' }, user: { id: 'u', email: 'e' } }), res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(mockLog.error).toHaveBeenCalled()
  })
})
