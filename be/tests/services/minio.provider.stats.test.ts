import { describe, it, expect, vi } from 'vitest'
import { MinioStorageProvider } from '@/services/storage/providers/minio.provider.js'
import { log } from '@/services/logger.service.js'

describe('MinioStorageProvider stats and admin operations', () => {
  it('checkFileExists returns true when statObject succeeds and false when throws', async () => {
    const client = { statObject: vi.fn().mockResolvedValue({}) } as any
    const provider = new MinioStorageProvider(client)
    expect(await provider.checkFileExists('b', 'o')).toBe(true)

    client.statObject = vi.fn().mockRejectedValue(new Error('not found'))
    const provider2 = new MinioStorageProvider(client)
    expect(await provider2.checkFileExists('b', 'o')).toBe(false)
  })

  it('deleteFolder removes objects when objects present', async () => {
    const items = [{ name: 'a' }, { name: 'b' }]
    const client = {
      listObjectsV2: async function* () { for (const i of items) yield i },
      removeObjects: vi.fn().mockResolvedValue(undefined),
    } as any
    const provider = new MinioStorageProvider(client)
    await provider.deleteFolder('bucket', 'path')
    expect(client.removeObjects).toHaveBeenCalledWith('bucket', ['a', 'b'])
  })

  it('getGlobalStats computes distribution and topFiles', async () => {
    const buckets = [{ name: 'b1' }]
    // items: small <1MB, medium 2MB, large 2GB
    const items = [
      { name: 'f1', size: 100 },
      { name: 'f2', size: 2 * 1024 * 1024 },
      { name: 'f3', size: 2 * 1024 * 1024 * 1024 },
    ]
    const client = {
      listBuckets: async () => buckets,
      listObjects: async function* () { for (const i of items) yield { ...i, lastModified: new Date() } },
    } as any

    const provider = new MinioStorageProvider(client)
    const stats = await provider.getGlobalStats()
    expect(stats.totalBuckets).toBe(1)
    expect(stats.totalObjects).toBe(3)
    expect(stats.topFiles.length).toBeGreaterThan(0)
    expect(stats.distribution['<1MB']).toBe(1)
    expect(stats.distribution['1MB-10MB']).toBe(1)
    expect(stats.distribution['1GB-5GB']).toBe(1)
  })

  it('listAccessKeys returns accounts mapped when adminRequest returns accounts, and returns [] on error', async () => {
    const client = {} as any
    const provider = new MinioStorageProvider(client)
    // spy on private adminRequest
    vi.spyOn(provider as any, 'adminRequest').mockResolvedValue({ accounts: ['a1', 'a2'] })
    const res = await provider.listAccessKeys()
    expect(res).toEqual([{ accessKey: 'a1', accountStatus: 'on' }, { accessKey: 'a2', accountStatus: 'on' }])

    ;(provider as any).adminRequest.mockRejectedValueOnce(new Error('boom'))
    const res2 = await provider.listAccessKeys()
    expect(res2).toEqual([])
  })

  it('createAccessKey calls adminRequest with correct payload and throws on error', async () => {
    const client = {} as any
    const provider = new MinioStorageProvider(client)
    const spy = vi.spyOn(provider as any, 'adminRequest').mockResolvedValue({ key: 'x' })
    const res = await provider.createAccessKey('readonly', 'n', 'd')
    expect(spy).toHaveBeenCalledWith('POST', 'minio/admin/v3/add-service-account', {}, expect.objectContaining({ policy: 'readonly' }))
    expect(res).toEqual({ key: 'x' })

    spy.mockRejectedValueOnce(new Error('fail'))
    await expect(provider.createAccessKey('readwrite')).rejects.toThrow()
  })

  it('deleteAccessKey calls adminRequest and throws on error', async () => {
    const client = {} as any
    const provider = new MinioStorageProvider(client)
    const spy = vi.spyOn(provider as any, 'adminRequest').mockResolvedValue({})
    await expect(provider.deleteAccessKey('ak')).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalledWith('POST', 'minio/admin/v3/delete-service-account', {}, { accessKey: 'ak' })

    spy.mockRejectedValueOnce(new Error('fail'))
    await expect(provider.deleteAccessKey('ak')).rejects.toThrow()
  })
})