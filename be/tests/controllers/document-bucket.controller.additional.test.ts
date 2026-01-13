import { describe, it, expect, vi } from 'vitest'
import { DocumentBucketController } from '@/controllers/document-bucket.controller.js'
import { documentBucketService } from '@/services/document-bucket.service.js'

describe.skip('DocumentBucketController additional error branches (skipped, merged)', () => {
  it('getAvailableBuckets returns 500 when service throws', async () => {
    const c = new DocumentBucketController()
    const req = { user: { id: 'u1' } } as any
    const res = { json: vi.fn(), status: vi.fn(() => res) } as any
    vi.spyOn(documentBucketService, 'getAvailableBuckets' as any).mockRejectedValueOnce(new Error('boom'))
    await c.getAvailableBuckets(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('createDocument returns 500 when service throws', async () => {
    const c = new DocumentBucketController()
    const req = { body: { bucket_name: 'x' }, user: { id: 'u' } } as any
    const res = { json: vi.fn(), status: vi.fn(() => res) } as any
    vi.spyOn(documentBucketService, 'createDocument' as any).mockRejectedValueOnce(new Error('boom'))
    await c.createDocument(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('destroyDocument returns 500 when service throws', async () => {
    const c = new DocumentBucketController()
    const req = { params: { bucketId: 'b' }, user: { id: 'u' } } as any
    const res = { json: vi.fn(), status: vi.fn(() => res), send: vi.fn() } as any
    vi.spyOn(documentBucketService, 'destroyDocument' as any).mockRejectedValueOnce(new Error('boom'))
    await c.destroyDocument(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('disableDocument returns 500 when service throws', async () => {
    const c = new DocumentBucketController()
    const req = { params: { bucketId: 'b' }, user: { id: 'u' } } as any
    const res = { json: vi.fn(), status: vi.fn(() => res), send: vi.fn() } as any
    vi.spyOn(documentBucketService, 'disableDocument' as any).mockRejectedValueOnce(new Error('boom'))
    await c.disableDocument(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})