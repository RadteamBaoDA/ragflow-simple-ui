/**
 * @fileoverview Unit tests for DocumentBucketService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentBucketService } from '../../src/services/document-bucket.service.js'
import { socketService } from '../../src/services/socket.service.js'
const mockModelFactory = vi.hoisted(() => ({
    minioBucket: {
        findAll: vi.fn(),
        findByIds: vi.fn(),
        findByName: vi.fn(),
        findById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
    userTeam: {
        findTeamsByUserId: vi.fn(),
    },
    documentPermission: {
        findAccessibleBucketIds: vi.fn(),
    },
}))

const mockStorageService = vi.hoisted(() => ({
    listBuckets: vi.fn(),
    createBucket: vi.fn(),
    deleteBucket: vi.fn(),
    listObjects: vi.fn(),
    deleteObjects: vi.fn(),
}))

const mockAuditService = vi.hoisted(() => ({
    log: vi.fn(),
}))

const mockLogger = vi.hoisted(() => ({
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
}))

vi.mock('../../src/models/factory.js', () => ({
    ModelFactory: mockModelFactory,
}))

vi.mock('../../src/services/storage/index.js', () => ({
    storageService: mockStorageService,
}))

vi.mock('../../src/services/audit.service.js', () => ({
    auditService: mockAuditService,
    AuditAction: {
        CREATE_DOCUMENT_BUCKET: 'create_document_bucket',
        DELETE_DOCUMENT_BUCKET: 'delete_document_bucket',
    },
    AuditResourceType: {
        BUCKET: 'bucket',
    },
}))

vi.mock('../../src/services/logger.service.js', () => ({
    log: mockLogger,
}))

vi.mock('../../src/services/socket.service.js', () => ({
    socketService: {
        broadcast: vi.fn(),
        emitToUser: vi.fn(),
    },
}))

describe('DocumentBucketService', () => {
    let service: DocumentBucketService

    beforeEach(() => {
        vi.clearAllMocks()
        service = new DocumentBucketService()
    })

    describe('getAccessibleBuckets', () => {
        it('should return all buckets for admin users', async () => {
            const adminUser = { id: 'user-1', role: 'admin' }
            const mockBuckets = [
                { id: 'b1', bucket_name: 'bucket1', is_active: 1 },
                { id: 'b2', bucket_name: 'bucket2', is_active: 1 },
            ]
            mockModelFactory.minioBucket.findAll.mockResolvedValueOnce(mockBuckets)

            const result = await service.getAccessibleBuckets(adminUser)

            expect(result).toEqual(mockBuckets)
            expect(mockModelFactory.minioBucket.findAll).toHaveBeenCalled()
        })

        it('should return all buckets for users with manage_storage permission', async () => {
            const user = {
                id: 'user-1',
                role: 'user',
                permissions: ['manage_storage'],
            }
            const mockBuckets = [
                { id: 'b1', bucket_name: 'bucket1', is_active: 1 },
            ]
            mockModelFactory.minioBucket.findAll.mockResolvedValueOnce(mockBuckets)

            const result = await service.getAccessibleBuckets(user)

            expect(result).toEqual(mockBuckets)
        })

        it('should parse JSON permissions string', async () => {
            const user = {
                id: 'user-1',
                role: 'user',
                permissions: JSON.stringify(['manage_storage']),
            }
            const mockBuckets = [
                { id: 'b1', bucket_name: 'bucket1', is_active: 1 },
            ]
            mockModelFactory.minioBucket.findAll.mockResolvedValueOnce(mockBuckets)

            const result = await service.getAccessibleBuckets(user)

            expect(result).toEqual(mockBuckets)
        })

        it('should handle invalid JSON permissions gracefully', async () => {
            const user = {
                id: 'user-1',
                role: 'user',
                permissions: 'invalid-json{',
            }
            mockModelFactory.userTeam.findTeamsByUserId.mockResolvedValueOnce([])
            mockModelFactory.documentPermission.findAccessibleBucketIds.mockResolvedValueOnce([])

            const result = await service.getAccessibleBuckets(user)

            expect(result).toEqual([])
        })

        it('should return empty array if regular user has no accessible buckets', async () => {
            const user = {
                id: 'user-1',
                role: 'user',
                permissions: [],
            }
            mockModelFactory.userTeam.findTeamsByUserId.mockResolvedValueOnce([])
            mockModelFactory.documentPermission.findAccessibleBucketIds.mockResolvedValueOnce([])

            const result = await service.getAccessibleBuckets(user)

            expect(result).toEqual([])
        })

        it('should return buckets accessible through team membership', async () => {
            const user = {
                id: 'user-1',
                role: 'user',
                permissions: [],
            }
            const mockBuckets = [
                { id: 'b1', bucket_name: 'bucket1', is_active: 1 },
            ]
            mockModelFactory.userTeam.findTeamsByUserId.mockResolvedValueOnce(['team-1'])
            mockModelFactory.documentPermission.findAccessibleBucketIds.mockResolvedValueOnce(['b1'])
            mockModelFactory.minioBucket.findByIds.mockResolvedValueOnce(mockBuckets)

            const result = await service.getAccessibleBuckets(user)

            expect(result).toEqual(mockBuckets)
            expect(mockModelFactory.documentPermission.findAccessibleBucketIds).toHaveBeenCalledWith('user-1', ['team-1'])
        })
    })

    describe('getAvailableBuckets', () => {
        it('should return unconfigured buckets from MinIO', async () => {
            const minioBuckets = [
                { name: 'bucket1', creationDate: new Date() },
                { name: 'bucket2', creationDate: new Date() },
            ]
            const configuredBuckets = [
                { bucket_name: 'bucket1', is_active: 1 },
            ]
            mockStorageService.listBuckets.mockResolvedValueOnce(minioBuckets)
            mockModelFactory.minioBucket.findAll.mockResolvedValueOnce(configuredBuckets)

            const result = await service.getAvailableBuckets()

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('bucket2')
        })

        it('should return empty array if all buckets are configured', async () => {
            const minioBuckets = [
                { name: 'bucket1', creationDate: new Date() },
            ]
            const configuredBuckets = [
                { bucket_name: 'bucket1', is_active: 1 },
            ]
            mockStorageService.listBuckets.mockResolvedValueOnce(minioBuckets)
            mockModelFactory.minioBucket.findAll.mockResolvedValueOnce(configuredBuckets)

            const result = await service.getAvailableBuckets()

            expect(result).toEqual([])
        })

        it('should filter out buckets with null names', async () => {
            const minioBuckets = [
                { name: null, creationDate: new Date() },
                { name: 'bucket1', creationDate: new Date() },
            ]
            mockStorageService.listBuckets.mockResolvedValueOnce(minioBuckets)
            mockModelFactory.minioBucket.findAll.mockResolvedValueOnce([])

            const result = await service.getAvailableBuckets()

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('bucket1')
        })
    })

    describe('createDocument', () => {
        it('should create a new bucket successfully', async () => {
            const user = { id: 'user-1', email: 'user@test.com', ip: '192.168.1.1' }
            const mockBucket = {
                id: 'bucket-1',
                bucket_name: 'test-bucket',
                description: 'Test description',
                is_active: 1,
            }
            mockModelFactory.minioBucket.findByName.mockResolvedValueOnce(null)
            mockStorageService.createBucket.mockResolvedValueOnce(undefined)
            mockModelFactory.minioBucket.create.mockResolvedValueOnce(mockBucket)

            const result = await service.createDocument('test-bucket', 'Test description', user)

            expect(result).toEqual(mockBucket)
            expect(mockStorageService.createBucket).toHaveBeenCalledWith('test-bucket', user)
            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'create_document_bucket',
                    resourceType: 'bucket',
                    userId: 'user-1',
                })
            )
        })

        it('should throw error if bucket is already configured and active', async () => {
            const user = { id: 'user-1', email: 'user@test.com' }
            const existingBucket = { id: 'b1', bucket_name: 'test-bucket', is_active: 1 }
            mockModelFactory.minioBucket.findByName.mockResolvedValueOnce(existingBucket)

            await expect(service.createDocument('test-bucket', 'Test', user)).rejects.toThrow(
                "Bucket 'test-bucket' is already configured in the system."
            )
        })

        it('should reactivate an inactive bucket', async () => {
            const user = { id: 'user-1', email: 'user@test.com', ip: '192.168.1.1' }
            const inactiveBucket = { id: 'b1', bucket_name: 'test-bucket', is_active: 0 }
            mockModelFactory.minioBucket.findByName.mockResolvedValueOnce(inactiveBucket)
            mockStorageService.createBucket.mockResolvedValueOnce(undefined)
            mockModelFactory.minioBucket.update.mockResolvedValueOnce({
                ...inactiveBucket,
                is_active: 1,
            })

            const result = await service.createDocument('test-bucket', 'Test', user)

            expect(mockModelFactory.minioBucket.update).toHaveBeenCalledWith('b1', expect.objectContaining({
                is_active: 1,
            }))
            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    details: expect.objectContaining({ status: 'reactivated' }),
                })
            )
        })

        it('should set created_by and updated_by from user context', async () => {
            const user = { id: 'user-1', email: 'user@test.com' }
            const mockBucket = {
                id: 'bucket-1',
                bucket_name: 'test-bucket',
                created_by: 'user-1',
                updated_by: 'user-1',
            }
            mockModelFactory.minioBucket.findByName.mockResolvedValueOnce(null)
            mockStorageService.createBucket.mockResolvedValueOnce(undefined)
            mockModelFactory.minioBucket.create.mockResolvedValueOnce(mockBucket)

            await service.createDocument('test-bucket', 'Test', user)

            const createCall = mockModelFactory.minioBucket.create.mock.calls[0][0]
            expect(createCall.created_by).toBe('user-1')
            expect(createCall.updated_by).toBe('user-1')
        })

        it('should set created_by to system if no user context', async () => {
            const mockBucket = {
                id: 'bucket-1',
                bucket_name: 'test-bucket',
                created_by: 'system',
                updated_by: 'system',
            }
            mockModelFactory.minioBucket.findByName.mockResolvedValueOnce(null)
            mockStorageService.createBucket.mockResolvedValueOnce(undefined)
            mockModelFactory.minioBucket.create.mockResolvedValueOnce(mockBucket)

            await service.createDocument('test-bucket', 'Test', null)

            const createCall = mockModelFactory.minioBucket.create.mock.calls[0][0]
            expect(createCall.created_by).toBe('system')
        })

        it('should log error if bucket creation fails', async () => {
            const user = { id: 'user-1', email: 'user@test.com' }
            const error = new Error('Storage failed')
            mockModelFactory.minioBucket.findByName.mockResolvedValueOnce(null)
            mockStorageService.createBucket.mockRejectedValueOnce(error)

            await expect(service.createDocument('test-bucket', 'Test', user)).rejects.toThrow('Storage failed')
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to create bucket',
                expect.objectContaining({
                    bucketName: 'test-bucket',
                    error: expect.stringContaining('Storage failed'),
                })
            )
        })

        it('should include user ip in audit log', async () => {
            const user = { id: 'user-1', email: 'user@test.com', ip: '192.168.1.1' }
            const mockBucket = { id: 'bucket-1', bucket_name: 'test-bucket' }
            mockModelFactory.minioBucket.findByName.mockResolvedValueOnce(null)
            mockStorageService.createBucket.mockResolvedValueOnce(undefined)
            mockModelFactory.minioBucket.create.mockResolvedValueOnce(mockBucket)

            await service.createDocument('test-bucket', 'Test', user)

            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    ipAddress: '192.168.1.1',
                })
            )
        })

        describe('destroyDocument', () => {
            it('should delete empty bucket and notify completion', async () => {
                const user = { id: 'u1' }
                mockStorageService.listObjects.mockResolvedValueOnce([])
                mockStorageService.deleteBucket.mockResolvedValueOnce(undefined)

                await service.destroyDocument('bucket1', user as any)

                expect(mockStorageService.deleteBucket).toHaveBeenCalledWith('bucket1', user)
                expect(socketService.emitToUser).toHaveBeenCalled()
            })

            it('should delete objects in batches and emit progress', async () => {
                const user = { id: 'u2' }
                // create 250 objects
                const objects = Array.from({ length: 250 }, (_, i) => ({ name: `obj-${i}` }))
                mockStorageService.listObjects.mockResolvedValueOnce(objects)
                mockStorageService.deleteObjects = vi.fn().mockResolvedValue(undefined)
                mockStorageService.deleteBucket.mockResolvedValueOnce(undefined)

                await service.destroyDocument('bucket2', user as any)

                // expect deleteObjects called ceil(250/100) = 3 times
                expect(mockStorageService.deleteObjects).toHaveBeenCalledTimes(3)
                expect(mockStorageService.deleteBucket).toHaveBeenCalledWith('bucket2', user)
            })

            it('should notify error and rethrow when listObjects fails', async () => {
                const user = { id: 'u3' }
                mockStorageService.listObjects.mockRejectedValueOnce(new Error('list failed'))
                const spyEmit = socketService.emitToUser

                await expect(service.destroyDocument('bucket3', user as any)).rejects.toThrow('list failed')
                expect(spyEmit).toHaveBeenCalledWith(user.id, 'bucket:delete:progress', expect.objectContaining({ status: 'error' }))
            })
        })

        describe('disableDocument', () => {
            it('should throw when bucket not found', async () => {
                const user = { id: 'u4', email: 'u4@test.com' }
                mockModelFactory.minioBucket.findById.mockResolvedValueOnce(null)

                await expect(service.disableDocument('nope', user as any)).rejects.toThrow('Bucket not found')
                expect(mockLogger.error).toHaveBeenCalledWith('Failed to disable bucket', expect.objectContaining({ bucketId: 'nope' }))
            })

            it('should disable and audit when bucket exists', async () => {
                const user = { id: 'u5', email: 'u5@test.com' }
                const bucket = { id: 'b5', bucket_name: 'bn' }
                mockModelFactory.minioBucket.findById.mockResolvedValueOnce(bucket)
                mockModelFactory.minioBucket.update.mockResolvedValueOnce(undefined)

                await service.disableDocument('b5', user as any)

                expect(mockModelFactory.minioBucket.update).toHaveBeenCalledWith('b5', { is_active: 0 })
                expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({ resourceId: 'b5' }))
            })
        })
    })
})
