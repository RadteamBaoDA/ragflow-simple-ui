import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MinioStorageProvider } from '@/services/storage/providers/minio.provider.js'
import { log } from '@/services/logger.service.js'

describe('MinioStorageProvider extra branches', () => {
  let provider: MinioStorageProvider
  beforeEach(() => {
    vi.restoreAllMocks()
    provider = new MinioStorageProvider({} as any)
  })

  it('listAccessKeys maps accounts on success', async () => {
    vi.spyOn(provider as any, 'adminRequest' as any).mockResolvedValueOnce({ accounts: ['a', 'b'] })
    const res = await provider.listAccessKeys()
    expect(res).toEqual([{ accessKey: 'a', accountStatus: 'on' }, { accessKey: 'b', accountStatus: 'on' }])
  })

  it('listAccessKeys returns empty array on error', async () => {
    vi.spyOn(provider as any, 'adminRequest' as any).mockRejectedValueOnce(new Error('boom'))
    const res = await provider.listAccessKeys()
    expect(res).toEqual([])
  })

  it('createAccessKey returns result on success and throws on error', async () => {
    vi.spyOn(provider as any, 'adminRequest' as any).mockResolvedValueOnce({ created: true })
    const r = await provider.createAccessKey('readonly')
    expect(r).toEqual({ created: true })

    vi.spyOn(provider as any, 'adminRequest' as any).mockRejectedValueOnce(new Error('nope'))
    await expect(provider.createAccessKey('readwrite')).rejects.toThrow()
  })

  it('deleteAccessKey resolves on success and throws on error', async () => {
    vi.spyOn(provider as any, 'adminRequest' as any).mockResolvedValueOnce(null)
    await expect(provider.deleteAccessKey('k')).resolves.toBeUndefined()

    vi.spyOn(provider as any, 'adminRequest' as any).mockRejectedValueOnce(new Error('boom'))
    await expect(provider.deleteAccessKey('k2')).rejects.toThrow()
  })

  it('getGlobalStats computes distribution and handles listObjects errors', async () => {
    // fake client with listBuckets and listObjects
    const mockClient: any = {
      listBuckets: vi.fn().mockResolvedValueOnce([{ name: 'b1' }, { name: 'b2' }]),
      listObjects: vi.fn()
    }

    // bucket b1 yields several items of various sizes
    const b1Iter = (async function* () {
      yield { name: 'a', size: 512, lastModified: new Date() }
      yield { name: 'b', size: 2 * 1024 * 1024, lastModified: new Date() }
      yield { name: 'c', size: 50 * 1024 * 1024, lastModified: new Date() }
      yield { name: 'd', size: 2 * 1024 * 1024 * 1024, lastModified: new Date() }
      yield { name: 'e', size: 11 * 1024 * 1024 * 1024, lastModified: new Date() }
    })()

    // bucket b2 throws when listing
    const throwingIter = (async function* () { throw new Error('fail listing') })()

    mockClient.listObjects.mockImplementation((bucketName: string) => bucketName === 'b1' ? b1Iter : throwingIter)

    const p = new MinioStorageProvider(mockClient as any)
    // spy on log.error when b2 fails
    const spyErr = vi.spyOn(log, 'error').mockImplementation(() => {})

    const stats = await p.getGlobalStats()

    expect(stats.totalBuckets).toBe(2)
    expect(stats.totalObjects).toBe(5) // all non-folder objects from b1
    expect(stats.distribution['<1MB']).toBe(1)
    expect(stats.distribution['1MB-10MB']).toBe(1)
    expect(stats.distribution['10MB-100MB']).toBe(1)
    expect(stats.distribution['1GB-5GB']).toBe(1)
    expect(stats.distribution['>10GB']).toBe(1)
    expect(spyErr).toHaveBeenCalled()
  })
})
