import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentBucketController } from '@/controllers/document-bucket.controller.js'
import { documentBucketService } from '@/services/document-bucket.service.js'
import * as ip from '@/utils/ip.js'

describe('DocumentBucketController (combined)', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('getAccessibleBuckets returns 401 when no user', async () => {
    const c = new DocumentBucketController()
    const req = {} as any
    const res = { json: vi.fn(), status: vi.fn(() => res) } as any
    await c.getAccessibleBuckets(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
  })

  it('getAccessibleBuckets returns buckets on success', async () => {
    const c = new DocumentBucketController()
    const buckets = [{ id: 'b1' }]
    vi.spyOn(documentBucketService, 'getAccessibleBuckets' as any).mockResolvedValueOnce(buckets)
    const req = { user: { id: 'u1' } } as any
    const res = { json: vi.fn(), status: vi.fn(() => res) } as any
    await c.getAccessibleBuckets(req, res)
    expect(res.json).toHaveBeenCalledWith({ buckets })
  })

  it('getAvailableBuckets returns buckets on success', async () => {
    const c = new DocumentBucketController()
    const buckets = [{ id: 'x' }]
    vi.spyOn(documentBucketService, 'getAvailableBuckets' as any).mockResolvedValueOnce(buckets)
    const req = {} as any
    const res = { json: vi.fn(), status: vi.fn(() => res) } as any
    await c.getAvailableBuckets(req, res)
    expect(res.json).toHaveBeenCalledWith({ buckets })
  })

  it('getAvailableBuckets returns 500 when service throws', async () => {
    const c = new DocumentBucketController()
    const req = { user: { id: 'u1' } } as any
    const res = { json: vi.fn(), status: vi.fn(() => res) } as any
    vi.spyOn(documentBucketService, 'getAvailableBuckets' as any).mockRejectedValueOnce(new Error('boom'))
    await c.getAvailableBuckets(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('createDocument uses system user when no req.user', async () => {
    const c = new DocumentBucketController()
    const bucket = { id: 'b' }
    const createSpy = vi.spyOn(documentBucketService, 'createDocument' as any).mockResolvedValueOnce(bucket)
    const req = { body: { bucket_name: 'my' } } as any
    const res = { json: vi.fn(), status: vi.fn(() => res) } as any
    await c.createDocument(req, res)
    expect(createSpy).toHaveBeenCalledWith('my', undefined, { id: 'system', email: 'system' })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ bucket })
  })

  it('createDocument passes user and ip when req.user present', async () => {
    const c = new DocumentBucketController()
    const bucket = { id: 'b2' }
    const createSpy = vi.spyOn(documentBucketService, 'createDocument' as any).mockResolvedValueOnce(bucket)
    vi.spyOn(ip, 'getClientIp').mockReturnValueOnce('1.2.3.4')
    const req = { body: { bucket_name: 'my2' }, user: { id: 'u2', email: 'a@b' } } as any
    const res = { json: vi.fn(), status: vi.fn(() => res) } as any
    await c.createDocument(req, res)
    expect(createSpy).toHaveBeenCalledWith('my2', undefined, { id: 'u2', email: 'a@b', ip: '1.2.3.4' })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ bucket })
  })

  it('createDocument returns 500 when service throws', async () => {
    const c = new DocumentBucketController()
    const req = { body: { bucket_name: 'x' }, user: { id: 'u' } } as any
    const res = { json: vi.fn(), status: vi.fn(() => res) } as any
    vi.spyOn(documentBucketService, 'createDocument' as any).mockRejectedValueOnce(new Error('boom'))
    await c.createDocument(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('destroyDocument returns 400 when bucketId missing', async () => {
    const c = new DocumentBucketController()
    const req = { params: {} } as any
    const res = { json: vi.fn(), status: vi.fn(() => res), send: vi.fn() } as any
    await c.destroyDocument(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Bucket name is required' })
  })

  it('destroyDocument returns 204 on success', async () => {
    const c = new DocumentBucketController()
    const destroySpy = vi.spyOn(documentBucketService, 'destroyDocument' as any).mockResolvedValueOnce(undefined)
    vi.spyOn(ip, 'getClientIp').mockReturnValueOnce('9.9.9.9')
    const req = { params: { bucketId: 'b3' }, user: { id: 'u3', email: 'e' } } as any
    const res = { json: vi.fn(), status: vi.fn(() => res), send: vi.fn() } as any
    await c.destroyDocument(req, res)
    expect(destroySpy).toHaveBeenCalledWith('b3', { id: 'u3', email: 'e', ip: '9.9.9.9' })
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalled()
  })

  it('destroyDocument returns 500 when service throws', async () => {
    const c = new DocumentBucketController()
    const req = { params: { bucketId: 'b' }, user: { id: 'u' } } as any
    const res = { json: vi.fn(), status: vi.fn(() => res), send: vi.fn() } as any
    vi.spyOn(documentBucketService, 'destroyDocument' as any).mockRejectedValueOnce(new Error('boom'))
    await c.destroyDocument(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('disableDocument returns 400 when bucketId missing', async () => {
    const c = new DocumentBucketController()
    const req = { params: {} } as any
    const res = { json: vi.fn(), status: vi.fn(() => res), send: vi.fn() } as any
    await c.disableDocument(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Bucket ID is required' })
  })

  it('disableDocument returns 204 on success', async () => {
    const c = new DocumentBucketController()
    const disableSpy = vi.spyOn(documentBucketService, 'disableDocument' as any).mockResolvedValueOnce(undefined)
    vi.spyOn(ip, 'getClientIp').mockReturnValueOnce('8.8.8.8')
    const req = { params: { bucketId: 'b4' }, user: { id: 'u4', email: 'x' } } as any
    const res = { json: vi.fn(), status: vi.fn(() => res), send: vi.fn() } as any
    await c.disableDocument(req, res)
    expect(disableSpy).toHaveBeenCalledWith('b4', { id: 'u4', email: 'x', ip: '8.8.8.8' })
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalled()
  })
})
