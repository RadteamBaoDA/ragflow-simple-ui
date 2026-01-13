import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as minioProvider from '../../src/services/storage/providers/minio.provider'



describe('Minio provider additional tests', () => {
  beforeEach(() => vi.resetAllMocks())

  it('listBuckets returns buckets', async () => {
    const fakeClient = {
      listBuckets: async () => [{ name: 'bucket1', creationDate: new Date() }],
    } as any
    const provider = new minioProvider.MinioStorageProvider(fakeClient)
    const buckets = await provider.listBuckets()
    expect(buckets).toEqual([{ name: 'bucket1', creationDate: expect.any(Date) }])
  })

  it('createBucket handles exist case', async () => {
    const client = {
      bucketExists: async () => true,
      makeBucket: async () => undefined,
    } as any
    const provider = new minioProvider.MinioStorageProvider(client)
    // bucketExists mocked to true
    await expect(provider.createBucket('bucket1')).resolves.toBeUndefined()
  })

  it('makeBucket called when not exists', async () => {
    const mockClient = {
      bucketExists: async () => false,
      makeBucket: vi.fn(async (name: string, region: string) => undefined),
    } as any
    const provider = new minioProvider.MinioStorageProvider(mockClient)
    await expect(provider.createBucket('bucket2')).resolves.toBeUndefined()
    expect(mockClient.makeBucket).toHaveBeenCalledWith('bucket2', 'us-east-1')
  })

  it('removeBucket calls removeBucket', async () => {
    const client = {
      listObjects: async function* () { },
      removeObjects: async () => undefined,
      removeBucket: async () => undefined,
    } as any
    const provider = new minioProvider.MinioStorageProvider(client)
    await expect(provider.deleteBucket('bucket1')).resolves.toBeUndefined()
  })

  it('uploadFile uploads and returns message', async () => {
    const client = {
      putObject: async () => undefined,
      fPutObject: async () => undefined,
    } as any
    const provider = new minioProvider.MinioStorageProvider(client)
    const res = await provider.uploadFile('bucket1', { originalname: 'obj', buffer: Buffer.from('x'), mimetype: 'text/plain' } as any)
    expect(res).toEqual({ message: 'File uploaded' })
  })

  it('getPresignedUrl returns url', async () => {
    const client = {
      presignedGetObject: async () => 'url',
    } as any
    const provider = new minioProvider.MinioStorageProvider(client)
    const url = await provider.getPresignedUrl('bucket1', 'obj', 1000)
    expect(url).toEqual('url')
  })
})