/**
 * @fileoverview Unit tests for DocumentStorageService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentStorageService } from '../../src/services/document-storage.service.js'

const mockStorageService = vi.hoisted(() => ({
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
    deleteFile: vi.fn(),
    listFiles: vi.fn(),
    createFolder: vi.fn(),
    deleteFolder: vi.fn(),
    deleteObjects: vi.fn(),
    getDownloadUrl: vi.fn(),
    checkFileExists: vi.fn(),
}))

const mockModelFactory = vi.hoisted(() => ({
    minioBucket: {
        findById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    documentBucket: {
        findById: vi.fn(),
        create: vi.fn(),
    },
}))

const mockDocumentPermissionService = vi.hoisted(() => ({
    resolveUserPermission: vi.fn().mockResolvedValue(2),
    setPermission: vi.fn(),
}))

const mockAuditService = vi.hoisted(() => ({
    log: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
}))

vi.mock('../../src/services/storage/index.js', () => ({
    storageService: mockStorageService,
}))

vi.mock('../../src/models/factory.js', () => ({
    ModelFactory: mockModelFactory,
}))

vi.mock('../../src/services/document-permission.service.js', () => ({
    documentPermissionService: mockDocumentPermissionService,
    PermissionLevel: {
        NONE: 0,
        VIEWER: 1,
        EDITOR: 2,
        ADMIN: 3,
    },
}))

vi.mock('../../src/services/audit.service.js', () => ({
    auditService: mockAuditService,
    AuditAction: {
        UPLOAD_DOCUMENT: 'upload_document',
        DOWNLOAD_DOCUMENT: 'download_document',
        DELETE_DOCUMENT: 'delete_document',
    },
    AuditResourceType: {
        DOCUMENT: 'document',
    },
}))

vi.mock('../../src/services/logger.service.js', () => ({
    log: mockLog,
}))

vi.mock('../../src/config/rbac.js', () => ({
    isAdminRole: vi.fn((role) => role === 'admin'),
}))

describe('DocumentStorageService', () => {
    let service: DocumentStorageService

    beforeEach(() => {
        vi.clearAllMocks()
        service = new DocumentStorageService()
    })

    describe('verifyAccess', () => {
        it('should deny access when no user provided', async () => {
            const result = await service.verifyAccess(null, 'bucket-1', 1)

            expect(result).toBe(false)
            expect(mockLog.warn).toHaveBeenCalledWith('verifyAccess: No user provided')
        })

        it('should grant admin access without checking permissions', async () => {
            const admin = { id: 'admin-1', role: 'admin' }

            const result = await service.verifyAccess(admin, 'bucket-1', 1)

            expect(result).toBe(true)
            expect(mockDocumentPermissionService.resolveUserPermission).not.toHaveBeenCalled()
        })

        it('should check user permissions for non-admin', async () => {
            const user = { id: 'user-1', role: 'user' }
            mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(2)

            const result = await service.verifyAccess(user, 'bucket-1', 2)

            expect(result).toBe(true)
            expect(mockDocumentPermissionService.resolveUserPermission).toHaveBeenCalledWith('user-1', 'bucket-1')
        })

        it('should deny access when permission level is insufficient', async () => {
            const user = { id: 'user-1', role: 'user' }
            mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(1)

            const result = await service.verifyAccess(user, 'bucket-1', 2)

            expect(result).toBe(false)
        })

        it('should log debug information', async () => {
            const user = { id: 'user-1', role: 'user' }
            mockDocumentPermissionService.resolveUserPermission.mockResolvedValueOnce(1)

            await service.verifyAccess(user, 'bucket-1', 1)

            expect(mockLog.debug).toHaveBeenCalledWith(
                'verifyAccess: Check',
                expect.objectContaining({
                    userId: 'user-1',
                    role: 'user',
                    bucketId: 'bucket-1',
                })
            )
        })
    })

    describe('getBucketName', () => {
        it('should return bucket name when found', async () => {
            mockModelFactory.minioBucket.findById.mockResolvedValueOnce({
                id: 'bucket-1',
                bucket_name: 'test-bucket',
            })

            const name = await (service as any).getBucketName('bucket-1')

            expect(name).toBe('test-bucket')
        })

        it('should return null when bucket not found', async () => {
            mockModelFactory.minioBucket.findById.mockResolvedValueOnce(null)

            const name = await (service as any).getBucketName('bucket-1')

            expect(name).toBeNull()
        })

        it('should handle errors gracefully', async () => {
            mockModelFactory.minioBucket.findById.mockRejectedValueOnce(new Error('DB error'))

            const name = await (service as any).getBucketName('bucket-1')

            expect(name).toBeNull()
            expect(mockLog.error).toHaveBeenCalledWith('Failed to resolve bucket name', expect.any(Object))
        })
    })

    describe('initialization', () => {
        it('should create service instance', () => {
            expect(service).toBeDefined()
            expect(service instanceof DocumentStorageService).toBe(true)
        })
    })

    describe('file operations', () => {
        it('uploadFile uploads with prefix and audits', async () => {
            vi.spyOn(service as any, 'verifyAccess' as any).mockResolvedValue(true)
            mockModelFactory.minioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bk' })

            const file = { originalname: 'a.txt', size: 10, mimetype: 'text/plain' } as any
            const res = await service.uploadFile({ id: 'u', email: 'e' }, 'b1', [file], { prefix: 'pfx/' }, '1.2.3.4')

            expect(mockStorageService.uploadFile).toHaveBeenCalledWith('bk', expect.objectContaining({ originalname: 'pfx/a.txt' }))
            expect(res).toEqual([{ name: 'pfx/a.txt', status: 'uploaded' }])
            expect(mockAuditService.log).toHaveBeenCalled()
        })

        it('uploadFile preserves folder structure when preserveFolderStructure=true (no prefix)', async () => {
            vi.spyOn(service as any, 'verifyAccess' as any).mockResolvedValue(true)
            mockModelFactory.minioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bk' })

            const file = { originalname: 'a.txt', size: 10, mimetype: 'text/plain' } as any
            const res = await service.uploadFile({ id: 'u', email: 'e' }, 'b1', [file], { preserveFolderStructure: 'true', filePaths: 'dir/one.txt' }, '1.2.3.4')

            expect(mockStorageService.uploadFile).toHaveBeenCalledWith('bk', expect.objectContaining({ originalname: 'dir/one.txt' }))
            expect(res).toEqual([{ name: 'dir/one.txt', status: 'uploaded' }])
            expect(mockAuditService.log).toHaveBeenCalled()
        })

        it('uploadFile preserves folder structure and applies prefix when provided', async () => {
            vi.spyOn(service as any, 'verifyAccess' as any).mockResolvedValue(true)
            mockModelFactory.minioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bk' })

            const file = { originalname: 'a.txt', size: 10, mimetype: 'text/plain' } as any
            const res = await service.uploadFile({ id: 'u', email: 'e' }, 'b1', [file], { preserveFolderStructure: 'true', filePaths: ['dir/one.txt'], prefix: 'pfx' }, '1.2.3.4')

            expect(mockStorageService.uploadFile).toHaveBeenCalledWith('bk', expect.objectContaining({ originalname: 'pfx/dir/one.txt' }))
            expect(res).toEqual([{ name: 'pfx/dir/one.txt', status: 'uploaded' }])
            expect(mockAuditService.log).toHaveBeenCalled()
        })

        it('createFolder creates folder and audits', async () => {
            vi.spyOn(service as any, 'verifyAccess' as any).mockResolvedValue(true)
            mockModelFactory.minioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bk' })

            await service.createFolder({ id: 'u', email: 'e' }, 'b1', 'f', 'p/', '1.2.3.4')

            expect(mockStorageService.createFolder).toHaveBeenCalledWith('bk', 'p/f')
            expect(mockAuditService.log).toHaveBeenCalled()
        })

        it('deleteObject deletes file or folder and audits', async () => {
            vi.spyOn(service as any, 'verifyAccess' as any).mockResolvedValue(true)
            mockModelFactory.minioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bk' })

            await service.deleteObject({ id: 'u', email: 'e' }, 'b1', 'path.txt', false, '1.2.3.4')
            expect(mockStorageService.deleteFile).toHaveBeenCalledWith('bk', 'path.txt', 'u')
            expect(mockAuditService.log).toHaveBeenCalled()

            mockModelFactory.minioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bk' })
            await service.deleteObject({ id: 'u', email: 'e' }, 'b1', 'folder/', true, '1.2.3.4')
            expect(mockStorageService.deleteFolder).toHaveBeenCalledWith('bk', 'folder/')
        })

        it('batchDelete handles files and folders and audits', async () => {
            vi.spyOn(service as any, 'verifyAccess' as any).mockResolvedValue(true)
            mockModelFactory.minioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bk' })

            const items = [{ path: 'a.txt', isFolder: false }, { path: 'b/', isFolder: true }]
            await service.batchDelete({ id: 'u', email: 'e' }, 'b1', items, '1.2.3.4')

            expect(mockStorageService.deleteObjects).toHaveBeenCalledWith('bk', ['a.txt'])
            expect(mockStorageService.deleteFolder).toHaveBeenCalledWith('bk', 'b/')
            expect(mockAuditService.log).toHaveBeenCalled()
        })

        it('getDownloadUrl returns url and audits when not preview', async () => {
            vi.spyOn(service as any, 'verifyAccess' as any).mockResolvedValue(true)
            mockModelFactory.minioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bk' })
            mockStorageService.getDownloadUrl.mockResolvedValueOnce('http://x')

            const url = await service.getDownloadUrl({ id: 'u', email: 'e' }, 'b1', 'p', false, '1.2.3.4')
            expect(url).toBe('http://x')
            expect(mockAuditService.log).toHaveBeenCalled()

            // preview should not audit
            mockModelFactory.minioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bk' })
            mockStorageService.getDownloadUrl.mockResolvedValueOnce('http://y')
            vi.clearAllMocks()
            vi.spyOn(service as any, 'verifyAccess' as any).mockResolvedValue(true)
            const url2 = await service.getDownloadUrl({ id: 'u', email: 'e' }, 'b1', 'p', true, '1.2.3.4')
            expect(url2).toBe('http://y')
            expect(mockAuditService.log).not.toHaveBeenCalled()
        })

        it('checkFilesExistence returns existing files', async () => {
            vi.spyOn(service as any, 'verifyAccess' as any).mockResolvedValue(true)
            mockModelFactory.minioBucket.findById.mockResolvedValueOnce({ bucket_name: 'bk' })
            mockStorageService.checkFileExists.mockImplementation(async (_bk: string, p: string) => p === 'a.txt')

            const res = await service.checkFilesExistence({ id: 'u' }, 'b1', ['a.txt', 'b.txt'])
            expect(res).toEqual({ exists: ['a.txt'] })
        })
    })
})
