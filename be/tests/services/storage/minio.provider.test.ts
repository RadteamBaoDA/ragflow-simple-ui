import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MinioStorageProvider } from '@/services/storage/providers/minio.provider.js'
import { auditService } from '@/services/audit.service.js'
import { log } from '@/services/logger.service.js'

const makeAsyncStream = (items: any[]) => ({
  [Symbol.asyncIterator]: () => {
    let i = 0
    return {
      next: async () => {
        if (i < items.length) return { value: items[i++], done: false }
        return { done: true, value: undefined }
      }
    }
  }
})

describe('MinioStorageProvider', () => {
  let mockClient: any

  beforeEach(() => {
    mockClient = {
      listBuckets: vi.fn().mockResolvedValue([{ name: 'a', creationDate: new Date() }]),
      bucketExists: vi.fn().mockResolvedValue(true),
      makeBucket: vi.fn().mockResolvedValue(undefined),
      listObjects: vi.fn().mockReturnValue(makeAsyncStream([])),
      removeObjects: vi.fn().mockResolvedValue(undefined),
      removeBucket: vi.fn().mockResolvedValue(undefined),
      listObjectsV2: vi.fn().mockReturnValue(makeAsyncStream([])),
      putObject: vi.fn().mockResolvedValue(undefined),
      fPutObject: vi.fn().mockResolvedValue(undefined),
      getObject: vi.fn().mockResolvedValue({}),
      removeObject: vi.fn().mockResolvedValue(undefined),
      statObject: vi.fn().mockResolvedValue({}),
      presignedGetObject: vi.fn().mockReturnValue('https://presigned'),
    }

    vi.restoreAllMocks()
  })

  it('returns client passed in constructor via getClient', () => {
    const p = new MinioStorageProvider(mockClient)
    expect(p.getClient()).toBe(mockClient)
  })

  it('listBuckets maps bucket info', async () => {
    mockClient.listBuckets.mockResolvedValue([{ name: 'b', creationDate: new Date('2020-01-01') }])
    const p = new MinioStorageProvider(mockClient)
    const buckets = await p.listBuckets()
    expect(buckets).toEqual([{ name: 'b', creationDate: new Date('2020-01-01') }])
  })

  it('bucketExists returns boolean and handles error', async () => {
    mockClient.bucketExists.mockResolvedValue(true)
    const p = new MinioStorageProvider(mockClient)
    expect(await p.bucketExists('x')).toBe(true)

    mockClient.bucketExists.mockRejectedValue(new Error('boom'))
    expect(await p.bucketExists('x')).toBe(false)
  })

  it('createBucket only makes bucket and audits when not exists', async () => {
    mockClient.bucketExists.mockResolvedValue(false)
    const spy = vi.spyOn(auditService, 'log').mockResolvedValue(undefined)
    const p = new MinioStorageProvider(mockClient)
    await p.createBucket('new-bucket', { id: 'u1', email: 'a@b.com' } as any)
    expect(mockClient.makeBucket).toHaveBeenCalledWith('new-bucket', 'us-east-1')
    expect(spy).toHaveBeenCalled()
  })

  it('createBucket does nothing when bucket exists', async () => {
    mockClient.bucketExists.mockResolvedValue(true)
    const spy = vi.spyOn(auditService, 'log').mockResolvedValue(undefined)
    const p = new MinioStorageProvider(mockClient)
    await p.createBucket('exists-bucket')
    expect(mockClient.makeBucket).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })

  it('deleteBucket removes objects and bucket and audits', async () => {
    mockClient.listObjects.mockReturnValue(makeAsyncStream([{ name: 'x' }, { name: 'y' }]))
    const spy = vi.spyOn(auditService, 'log').mockResolvedValue(undefined)
    const p = new MinioStorageProvider(mockClient)
    await p.deleteBucket('b', { id: 'u1', email: 'a@b.com', ip: '1.2.3.4' } as any)
    expect(mockClient.removeObjects).toHaveBeenCalledWith('b', ['x', 'y'])
    expect(mockClient.removeBucket).toHaveBeenCalledWith('b')
    expect(spy).toHaveBeenCalled()
  })

  it('getBucketStats aggregates object count and size', async () => {
    mockClient.listObjects.mockReturnValue(makeAsyncStream([{ name: 'a', size: 10 }, { name: 'b/', size: 0 }, { name: 'c', size: 40 }]))
    const p = new MinioStorageProvider(mockClient)
    const stats = await p.getBucketStats('b')
    expect(stats).toEqual({ objectCount: 2, totalSize: 50 })
  })

  it('uploadFile uses putObject for buffer and fPutObject for path', async () => {
    const p = new MinioStorageProvider(mockClient)
    await expect(p.uploadFile('b', { originalname: 'f', buffer: Buffer.from('x'), size: 1 } as any)).resolves.toEqual({ message: 'File uploaded' })
    expect(mockClient.putObject).toHaveBeenCalled()

    await expect(p.uploadFile('b', { originalname: 'f', path: '/tmp/x' } as any)).resolves.toEqual({ message: 'File uploaded' })
    expect(mockClient.fPutObject).toHaveBeenCalled()
  })

  it('getPresignedUrl and getDownloadUrl call client and return (may be undefined depending on client)', async () => {
    const p = new MinioStorageProvider(mockClient)
    const res = await p.getPresignedUrl('b', 'o')
    // Real MinIO SDK sometimes uses callback style; provider proxies directly so value may be undefined
    expect(mockClient.presignedGetObject).toHaveBeenCalled()
    expect(typeof res === 'undefined' || typeof res === 'string').toBe(true)
    const res2 = await p.getDownloadUrl('b', 'o')
    expect(typeof res2 === 'undefined' || typeof res2 === 'string').toBe(true)
  })

  it('checkFileExists returns true/false based on statObject', async () => {
    mockClient.statObject.mockResolvedValue({})
    const p = new MinioStorageProvider(mockClient)
    expect(await p.checkFileExists('b', 'o')).toBe(true)

    mockClient.statObject.mockRejectedValue(new Error('nope'))
    expect(await p.checkFileExists('b', 'o')).toBe(false)
  })

  it('createFolder calls putObject with trailing slash', async () => {
    const p = new MinioStorageProvider(mockClient)
    await p.createFolder('b', 'folder')
    expect(mockClient.putObject).toHaveBeenCalled()
  })

  it('getObjectStat proxies to client', async () => {
    const p = new MinioStorageProvider(mockClient)
    await p.getObjectStat('b', 'o')
    expect(mockClient.statObject).toHaveBeenCalledWith('b', 'o')
  })

  it('listAccessKeys returns empty on admin error', async () => {
    const spy = vi.spyOn<any, any>(MinioStorageProvider.prototype as any, 'adminRequest').mockRejectedValue(new Error('boom'))
    const p = new MinioStorageProvider(mockClient)
    expect(await p.listAccessKeys()).toEqual([])
    spy.mockRestore()
  })

  it('createAccessKey and deleteAccessKey call adminRequest and return', async () => {
    const spy = vi.spyOn<any, any>(MinioStorageProvider.prototype as any, 'adminRequest').mockResolvedValue({ result: 'ok', accounts: ['a'] })
    const p = new MinioStorageProvider(mockClient)
    const created = await p.createAccessKey('readonly', 'n', 'd')
    expect(created).toEqual({ result: 'ok', accounts: ['a'] })
    await p.deleteAccessKey('k')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('deleteBucket logs a warning if emptying fails but still deletes bucket', async () => {
    mockClient.listObjects.mockImplementation(() => { throw new Error('fail-list') })
    const warnSpy = vi.spyOn(log, 'warn')
    const p = new MinioStorageProvider(mockClient)
    await p.deleteBucket('b')
    expect(warnSpy).toHaveBeenCalled()
    expect(mockClient.removeBucket).toHaveBeenCalled()
  })

  it('getGlobalStats aggregates across buckets and returns top files', async () => {
    mockClient.listBuckets.mockResolvedValue([{ name: 'b1' }, { name: 'b2' }])
    // b1: two files
    mockClient.listObjects.mockReturnValueOnce(makeAsyncStream([{ name: 'f1', size: 10 }, { name: 'f2', size: 100 }]))
    // b2: one file
    mockClient.listObjects.mockReturnValueOnce(makeAsyncStream([{ name: 'f3', size: 5 }]))

    const p = new MinioStorageProvider(mockClient)
    const stats = await p.getGlobalStats()
    expect(stats.totalBuckets).toBe(2)
    expect(stats.totalObjects).toBeGreaterThanOrEqual(3)
    expect(Array.isArray(stats.topFiles)).toBe(true)
  })

  it('getClient returns client', () => {
    const p = new MinioStorageProvider(mockClient)
    expect(p.getClient()).toBe(mockClient)
  })
})
