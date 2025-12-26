/**
 * @fileoverview Tests for MinioStorageController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MinioStorageController } from '../../src/controllers/minio-storage.controller.js'

const PermissionLevel = vi.hoisted(() => ({
  NONE: 0,
  VIEW: 1,
  UPLOAD: 2,
  FULL: 3,
}))

const mockMinioBucket = vi.hoisted(() => ({
  findById: vi.fn(),
}))

const mockMinioService = vi.hoisted(() => ({
  listFiles: vi.fn(),
  uploadFile: vi.fn(),
  createFolder: vi.fn(),
  deleteFile: vi.fn(),
  deleteFolder: vi.fn(),
  deleteObjects: vi.fn(),
  getDownloadUrl: vi.fn(),
  downloadFile: vi.fn(),
}))

const mockDocumentPermissionService = vi.hoisted(() => ({
  resolveUserPermission: vi.fn(),
}))

const mockAuditService = vi.hoisted(() => ({
  log: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('../../src/models/factory.js', () => ({
  ModelFactory: {
    minioBucket: mockMinioBucket,
  },
}))

vi.mock('../../src/services/minio.service.js', () => ({
  minioService: mockMinioService,
}))

vi.mock('../../src/services/document-permission.service.js', () => ({
  documentPermissionService: mockDocumentPermissionService,
  PermissionLevel,
}))

vi.mock('../../src/services/audit.service.js', () => ({
  auditService: mockAuditService,
  AuditAction: { UPLOAD_FILE: 'upload_file', CREATE_FOLDER: 'create_folder', DELETE_FILE: 'delete_file', DELETE_FOLDER: 'delete_folder', DOWNLOAD_FILE: 'download_file' },
  AuditResourceType: { FILE: 'file' },
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

const makeReq = (override: Record<string, any> = {}) => ({ headers: {}, socket: { remoteAddress: '1.1.1.1' }, query: {}, ...override })

describe('MinioStorageController', () => {
  const controller = new MinioStorageController()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listFiles validates missing bucketId', async () => {
    const res = makeRes()

    await controller.listFiles(makeReq({ params: {} }), res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('listFiles returns 403 when access denied', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(0)

    await controller.listFiles(makeReq({ params: { bucketId: 'b1' }, user: { id: 'u', role: 'user' } }), res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('listFiles returns 404 when bucket not found', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(1)
    mockMinioBucket.findById.mockResolvedValueOnce(null)

    await controller.listFiles(makeReq({ params: { bucketId: 'b1' }, user: { id: 'u', role: 'user' } }), res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('listFiles returns files for authorized user', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(1)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })
    mockMinioService.listFiles.mockResolvedValueOnce([{ name: 'file.txt' }])

    await controller.listFiles(makeReq({ params: { bucketId: 'b1' }, user: { id: 'u', role: 'user' }, query: { prefix: 'docs/' } }), res)

    expect(mockMinioService.listFiles).toHaveBeenCalledWith('bucket', 'docs/')
    expect(res.json).toHaveBeenCalledWith({ objects: [{ name: 'file.txt' }] })
  })

  it('uploadFile validates missing bucketId', async () => {
    const res = makeRes()

    await controller.uploadFile(makeReq({ params: {} }), res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('uploadFile returns 403 without upload permission', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(1)

    await controller.uploadFile(makeReq({ params: { bucketId: 'b1' }, user: { id: 'u', role: 'user' } }), res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('uploadFile returns 400 when no files', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(2)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })

    await controller.uploadFile(makeReq({ params: { bucketId: 'b1' }, user: { id: 'u', role: 'user' }, body: {} }), res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('uploadFile uploads file and returns 201', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(2)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })

    const file = { originalname: 'file.txt', size: 100, mimetype: 'text/plain' }
    await controller.uploadFile(makeReq({ params: { bucketId: 'b1' }, user: { id: 'u', email: 'e', role: 'user' }, file, body: {} }), res)

    expect(mockMinioService.uploadFile).toHaveBeenCalledWith('bucket', file, 'u')
    expect(mockAuditService.log).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('createFolder validates params', async () => {
    const res = makeRes()

    await controller.createFolder(makeReq({ params: { bucketId: 'b1' }, body: {} }), res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('createFolder creates and returns 201', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(2)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })

    await controller.createFolder(makeReq({ params: { bucketId: 'b1' }, body: { folderName: 'new/' }, user: { id: 'u', email: 'e', role: 'user' } }), res)

    expect(mockMinioService.createFolder).toHaveBeenCalledWith('bucket', 'new/')
    expect(mockAuditService.log).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('deleteObject validates params', async () => {
    const res = makeRes()

    await controller.deleteObject(makeReq({ params: { bucketId: 'b1' }, body: {} }), res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('deleteObject requires FULL permission', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(2)

    await controller.deleteObject(makeReq({ params: { bucketId: 'b1' }, body: { path: 'file.txt' }, user: { id: 'u', role: 'user' } }), res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('deleteObject deletes file and returns 204', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(3)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })

    await controller.deleteObject(makeReq({ params: { bucketId: 'b1' }, body: { path: 'file.txt', isFolder: false }, user: { id: 'u', email: 'e', role: 'user' } }), res)

    expect(mockMinioService.deleteFile).toHaveBeenCalledWith('bucket', 'file.txt', 'u')
    expect(mockAuditService.log).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('batchDelete validates params', async () => {
    const res = makeRes()

    await controller.batchDelete(makeReq({ params: { bucketId: 'b1' }, body: {} }), res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('batchDelete requires FULL permission', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(2)

    await controller.batchDelete(makeReq({ params: { bucketId: 'b1' }, body: { items: [] }, user: { id: 'u', role: 'user' } }), res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('batchDelete processes files and folders', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(3)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })
    mockMinioService.deleteObjects.mockResolvedValueOnce(undefined)

    await controller.batchDelete(makeReq({
      params: { bucketId: 'b1' },
      body: { items: [{ path: 'file.txt', isFolder: false }, { path: 'folder/', isFolder: true }] },
      user: { id: 'u', email: 'e', role: 'user' }
    }), res)

    expect(mockMinioService.deleteObjects).toHaveBeenCalledWith('bucket', ['file.txt'])
    expect(mockMinioService.deleteFolder).toHaveBeenCalledWith('bucket', 'folder/')
    expect(mockAuditService.log).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('getDownloadUrl validates params', async () => {
    const res = makeRes()

    await controller.getDownloadUrl(makeReq({ params: { bucketId: 'b1' } }), res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('getDownloadUrl requires VIEW permission', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(0)

    await controller.getDownloadUrl(makeReq({ params: { bucketId: 'b1', 0: 'file.txt' }, user: { id: 'u', role: 'user' } }), res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('getDownloadUrl returns download URL', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(1)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })
    mockMinioService.getDownloadUrl.mockResolvedValueOnce('https://minio.local/bucket/file.txt')

    await controller.getDownloadUrl(makeReq({
      params: { bucketId: 'b1', 0: 'file.txt' },
      query: { preview: 'false' },
      user: { id: 'u', email: 'e', role: 'user' }
    }), res)

    expect(mockMinioService.getDownloadUrl).toHaveBeenCalledWith('bucket', 'file.txt', 3600, 'attachment')
    expect(mockAuditService.log).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ download_url: 'https://minio.local/bucket/file.txt' })
  })

  it('getDownloadUrl with preview mode', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(1)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })
    mockMinioService.getDownloadUrl.mockResolvedValueOnce('https://minio.local/bucket/file.txt')

    await controller.getDownloadUrl(makeReq({
      params: { bucketId: 'b1', objectPath: 'file.txt' },
      query: { preview: 'true' },
      user: { id: 'u', role: 'user' }
    }), res)

    expect(mockMinioService.getDownloadUrl).toHaveBeenCalledWith('bucket', 'file.txt', 3600, 'inline')
    expect(mockAuditService.log).not.toHaveBeenCalled()
  })

  it('uploadFile with multiple files', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(2)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })

    const files = [
      { originalname: 'file1.txt', size: 100, mimetype: 'text/plain' },
      { originalname: 'file2.txt', size: 200, mimetype: 'text/plain' }
    ]
    await controller.uploadFile(makeReq({ params: { bucketId: 'b1' }, user: { id: 'u', email: 'e', role: 'user' }, files, body: {} }), res)

    expect(mockMinioService.uploadFile).toHaveBeenCalledTimes(2)
    expect(mockAuditService.log).toHaveBeenCalledTimes(2)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('uploadFile with prefix', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(2)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })

    const file = { originalname: 'file.txt', size: 100, mimetype: 'text/plain' }
    await controller.uploadFile(makeReq({
      params: { bucketId: 'b1' },
      query: { prefix: 'docs/' },
      user: { id: 'u', email: 'e', role: 'user' },
      file,
      body: {}
    }), res)

    expect(file.originalname).toBe('docs/file.txt')
  })

  it('uploadFile with preserveFolderStructure', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(2)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })

    const files = [{ originalname: 'file.txt', size: 100, mimetype: 'text/plain' }]
    await controller.uploadFile(makeReq({
      params: { bucketId: 'b1' },
      user: { id: 'u', email: 'e', role: 'user' },
      files,
      body: { preserveFolderStructure: 'true', filePaths: ['sub/folder/file.txt'] }
    }), res)

    expect(files[0].originalname).toBe('sub/folder/file.txt')
  })

  it('deleteObject deletes folder', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(3)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })

    await controller.deleteObject(makeReq({
      params: { bucketId: 'b1' },
      body: { path: 'folder/', isFolder: true },
      user: { id: 'u', email: 'e', role: 'user' }
    }), res)

    expect(mockMinioService.deleteFolder).toHaveBeenCalledWith('bucket', 'folder/')
  })

  it('listFiles handles service errors', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(1)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })
    mockMinioService.listFiles.mockRejectedValueOnce(new Error('Service error'))

    await controller.listFiles(makeReq({ params: { bucketId: 'b1' }, user: { id: 'u', role: 'user' } }), res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('uploadFile handles service errors', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(2)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })
    mockMinioService.uploadFile.mockRejectedValueOnce(new Error('Upload failed'))

    const file = { originalname: 'file.txt', size: 100, mimetype: 'text/plain' }
    await controller.uploadFile(makeReq({ params: { bucketId: 'b1' }, user: { id: 'u', email: 'e', role: 'user' }, file, body: {} }), res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('createFolder handles service errors', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(2)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })
    mockMinioService.createFolder.mockRejectedValueOnce(new Error('Create failed'))

    await controller.createFolder(makeReq({
      params: { bucketId: 'b1' },
      body: { folderName: 'new/' },
      user: { id: 'u', email: 'e', role: 'user' }
    }), res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('deleteObject handles service errors', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(3)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })
    mockMinioService.deleteFile.mockRejectedValueOnce(new Error('Delete failed'))

    await controller.deleteObject(makeReq({
      params: { bucketId: 'b1' },
      body: { path: 'file.txt', isFolder: false },
      user: { id: 'u', email: 'e', role: 'user' }
    }), res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('batchDelete handles service errors', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(3)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })
    mockMinioService.deleteObjects.mockRejectedValueOnce(new Error('Batch delete failed'))

    await controller.batchDelete(makeReq({
      params: { bucketId: 'b1' },
      body: { items: [{ path: 'file.txt', isFolder: false }] },
      user: { id: 'u', email: 'e', role: 'user' }
    }), res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('getDownloadUrl handles service errors', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(1)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })
    mockMinioService.getDownloadUrl.mockRejectedValueOnce(new Error('URL generation failed'))

    await controller.getDownloadUrl(makeReq({
      params: { bucketId: 'b1', 0: 'file.txt' },
      user: { id: 'u', role: 'user' }
    }), res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('createFolder with prefix', async () => {
    const res = makeRes()
    mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(2)
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })

    await controller.createFolder(makeReq({
      params: { bucketId: 'b1' },
      body: { folderName: 'new/', prefix: 'docs/' },
      user: { id: 'u', email: 'e', role: 'user' }
    }), res)

    expect(mockMinioService.createFolder).toHaveBeenCalledWith('bucket', 'docs/new/')
  })

  it('admin role bypasses permission checks', async () => {
    const res = makeRes()
    mockMinioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bucket' })
    mockMinioService.listFiles.mockResolvedValueOnce([])

    await controller.listFiles(makeReq({
      params: { bucketId: 'b1' },
      user: { id: 'admin', role: 'admin' }
    }), res)

    expect(mockDocumentPermissionService.resolveUserPermission).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ objects: [] })
  })

  it('downloadFile returns 404', async () => {
    const res = makeRes()

    await controller.downloadFile(makeReq({}), res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: "Use getDownloadUrl" })
  })
})
