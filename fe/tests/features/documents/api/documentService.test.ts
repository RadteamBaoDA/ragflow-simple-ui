/**
 * @fileoverview Unit tests for documentService
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getBuckets,
  getAvailableBuckets,
  createBucket,
  destroyBucket,
  listObjects,
  uploadFiles,
  getDownloadUrl,
  deleteObject,
  batchDelete,
  createFolder,
  getAccessKeys,
  createAccessKey,
  deleteAccessKey,
  getAllPermissions,
  setPermission,
  getEffectivePermission,
  DocumentServiceError,
} from '../../../../src/features/documents/api/documentService'

const API_BASE_URL = ''

describe('documentService', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getBuckets', () => {
    it('returns buckets on success', async () => {
      const mockBuckets = [{ id: '1', bucket_name: 'test', display_name: 'Test' }]
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ buckets: mockBuckets }),
      } as Response)

      const result = await getBuckets()
      expect(result).toEqual(mockBuckets)
      expect(fetch).toHaveBeenCalled()
    })

    it('throws error on failed fetch', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ 
        ok: false, 
        statusText: 'Forbidden',
        json: async () => ({}),
      } as Response)
      await expect(getBuckets()).rejects.toThrow('Failed to fetch buckets: Forbidden')
    })
  })

  describe('getAvailableBuckets', () => {
    it('returns available buckets', async () => {
      const mockBuckets = [{ name: 'bucket-1', creationDate: '2024-01-01' }]
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ buckets: mockBuckets }),
      } as Response)

      const result = await getAvailableBuckets()
      expect(result).toEqual(mockBuckets)
    })

    it('throws error on failed fetch', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Error', json: async () => ({ error: 'Error' }) } as Response)
      await expect(getAvailableBuckets()).rejects.toThrow('Failed to fetch available buckets')
    })
  })

  describe('createBucket', () => {
    it('creates bucket successfully', async () => {
      const dto = { bucket_name: 'new-bucket', display_name: 'New' }
      const created = { id: '1', ...dto, created_by: 'user1', created_at: '2024-01-01', is_active: true }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bucket: created }),
      } as Response)

      const result = await createBucket(dto)
      expect(result).toEqual(created)
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/document/buckets'), expect.objectContaining({ method: 'POST' }))
    })

    it('throws error on failed creation', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Conflict', json: async () => ({}) } as Response)
      await expect(createBucket({ bucket_name: 'test', display_name: 'Test' })).rejects.toThrow('Failed to add bucket configuration')
    })
  })

  describe('destroyBucket', () => {
    it('destroys bucket successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response)
      await expect(destroyBucket('bucket-id')).resolves.toBeUndefined()
    })

    it('throws error on failed destruction', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Not Found', json: async () => ({}) } as Response)
      await expect(destroyBucket('bucket-id')).rejects.toThrow('Failed to destroy bucket')
    })
  })

  describe('listObjects', () => {
    it('lists objects in bucket', async () => {
      const mockFiles = [{ name: 'file.txt', size: 1024, lastModified: new Date(), etag: 'abc', isFolder: false }]
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ objects: mockFiles }),
      } as Response)

      const result = await listObjects('bucket-1')
      expect(result).toEqual(mockFiles)
    })

    it('includes prefix in query', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      } as Response)

      await listObjects('bucket-1', 'folder/')
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('prefix=folder%2F'), expect.any(Object))
    })

    it('throws error on failed list', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Error', json: async () => ({ message: 'List failed', code: 'LIST_ERR' }) } as Response)
      await expect(listObjects('bucket-1')).rejects.toThrow('List failed')
    })
  })

  describe.skip('uploadFiles', () => {
    it('uploads files successfully', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const uploaded = [{ name: 'test.txt', size: 7, etag: 'abc' }]
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadedFiles: uploaded }),
      } as Response)

      const result = await uploadFiles('bucket-1', [file])
      expect(result).toEqual(uploaded)
    })

    it('includes prefix in upload', async () => {
      const file = new File(['content'], 'test.txt')
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadedFiles: [] }),
      } as Response)

      await uploadFiles('bucket-1', [file], 'folder/', vi.fn())
      const calls = vi.mocked(fetch).mock.calls
      expect(calls[0][0]).toContain('prefix=folder%2F')
    })

    it('throws error on failed upload', async () => {
      const file = new File(['content'], 'test.txt')
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Error' } as Response)
      await expect(uploadFiles('bucket-1', [file])).rejects.toThrow('Failed to upload files')
    })
  })

  describe('getDownloadUrl', () => {
    it('returns download URL', async () => {
      const mockUrl = 'https://storage.com/bucket/file.txt'
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ download_url: mockUrl }),
      } as Response)

      const result = await getDownloadUrl('bucket-1', 'file.txt')
      expect(result).toBe(mockUrl)
    })

    it('throws error on failed download', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Not Found', json: async () => ({}) } as Response)
      await expect(getDownloadUrl('bucket-1', 'missing.txt')).rejects.toThrow('Failed to get download URL')
    })
  })

  describe('deleteObject', () => {
    it('deletes object successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response)
      await expect(deleteObject('bucket-1', 'file.txt')).resolves.toBeUndefined()
    })

    it('throws error on failed deletion', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Error', json: async () => ({}) } as Response)
      await expect(deleteObject('bucket-1', 'file.txt')).rejects.toThrow('Failed to delete object')
    })
  })

  describe('batchDelete', () => {
    it('deletes multiple objects', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response)
      // batchDelete expects an array of objects with name/isFolder
      await expect(batchDelete('bucket-1', [{ name: 'file1.txt', isFolder: false }, { name: 'file2.txt', isFolder: false }])).resolves.toBeUndefined()
      const called = vi.mocked(fetch).mock.calls[0]
      expect(called[1]).toBeTruthy()
      const body = JSON.parse(called[1].body)
      expect(body.items).toBeTruthy()
      expect(body.items.map((i: any) => i.path)).toEqual(['file1.txt','file2.txt'])
    })

    it('throws error on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Error', json: async () => ({}) } as Response)
      await expect(batchDelete('bucket-1', [{ name: 'file.txt', isFolder: false }])).rejects.toThrow('Failed to batch delete')
    })
  })

  describe('createFolder', () => {
    it('creates folder successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response)
      await expect(createFolder('bucket-1', 'newfolder')).resolves.toBeUndefined()
    })

    it('throws error on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Error', json: async () => ({}) } as Response)
      await expect(createFolder('bucket-1', 'newfolder')).rejects.toThrow('Failed to create folder')
    })
  })

  describe('getAccessKeys', () => {
    it('returns access keys', async () => {
      const keys = [{ accessKey: 'key1', parentUser: 'user1', accountStatus: 'active' }]
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ keys }),
      } as Response)

      const result = await getAccessKeys()
      expect(result).toEqual(keys)
    })

    it('throws error on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Error', json: async () => ({}) } as Response)
      await expect(getAccessKeys()).rejects.toThrow('Failed to fetch access keys')
    })
  })

  describe('createAccessKey', () => {
    it('creates access key', async () => {
      const newKey = { accessKey: 'new-key', secretKey: 'secret' }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => newKey,
      } as Response)

      const result = await createAccessKey('policy-json')
      expect(result).toEqual(newKey)
    })

    it('throws error on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Error', json: async () => ({}) } as Response)
      await expect(createAccessKey('policy-json')).rejects.toThrow('Failed to create access key')
    })
  })

  describe('deleteAccessKey', () => {
    it('deletes access key', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response)
      await expect(deleteAccessKey('key1')).resolves.toBeUndefined()
    })

    it('throws error on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Error' } as Response)
      await expect(deleteAccessKey('key1')).rejects.toThrow('Failed to delete access key')
    })
  })

  describe('getAllPermissions', () => {
    it('returns all permissions', async () => {
      const perms = [{ id: '1', entity_type: 'user', permission_level: 2 }]
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => perms,
      } as Response)

      const result = await getAllPermissions()
      expect(result).toEqual(perms)
    })

    it('filters by bucket ID', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)

      await getAllPermissions('bucket-1')
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('bucketId=bucket-1'), expect.any(Object))
    })

    it('throws error on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Error' } as Response)
      await expect(getAllPermissions()).rejects.toThrow('Failed to fetch permissions')
    })
  })

  describe('setPermission', () => {
    it('sets permission successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response)
      await expect(setPermission('user', 'user-1', 'bucket-1', 2)).resolves.toBeUndefined()
    })

    it('throws error on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Error' } as Response)
      await expect(setPermission('user', 'user-1', 'bucket-1', 2)).rejects.toThrow('Failed to set permission')
    })
  })

  describe('getEffectivePermission', () => {
    it('gets effective permission level', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ level: 2 }),
      } as Response)

      const result = await getEffectivePermission('bucket-1')
      expect(result).toBe(2)
    })

    it('throws error on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Error' } as Response)
      await expect(getEffectivePermission('bucket-1')).rejects.toThrow('Failed to resolve permission')
    })
  })

  describe('DocumentServiceError', () => {
    it('creates error with code', () => {
      const err = new DocumentServiceError('Test error', 'TEST_CODE')
      expect(err.message).toBe('Test error')
      expect(err.code).toBe('TEST_CODE')
      expect(err.name).toBe('DocumentServiceError')
    })

    it('creates error without code', () => {
      const err = new DocumentServiceError('Test error')
      expect(err.code).toBeUndefined()
    })
  })
})
