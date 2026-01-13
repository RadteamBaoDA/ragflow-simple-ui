
/**
 * @fileoverview Unit tests for DocumentPermissionService using ModelFactory mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentPermissionService, PermissionLevel } from '../../src/services/document-permission.service.js'

const mockLog = vi.hoisted(() => ({
    error: vi.fn(),
    debug: vi.fn(),
}))

vi.mock('../../src/services/logger.service.js', () => ({
    log: mockLog,
}))

const mockAudit = vi.hoisted(() => ({
    log: vi.fn(),
}))

vi.mock('../../src/services/audit.service.js', () => ({
    auditService: mockAudit,
    AuditAction: {
        SET_PERMISSION: 'set_permission',
    },
    AuditResourceType: {
        PERMISSION: 'permission',
    },
}))

const mockModels = vi.hoisted(() => ({
    documentPermission: {
        findByEntityAndBucket: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        findAll: vi.fn(),
    },
    user: {
        findById: vi.fn(),
    },
    userTeam: {
        findAll: vi.fn(),
    },
}))

vi.mock('../../src/models/factory.js', () => ({
    ModelFactory: mockModels,
}))

const service = new DocumentPermissionService()

const resetMocks = () => {
    vi.clearAllMocks()
    Object.values(mockModels.documentPermission).forEach(fn => fn.mockReset())
    mockModels.user.findById.mockReset()
    mockModels.userTeam.findAll.mockReset()
    mockAudit.log.mockReset()
    mockLog.error.mockReset()
}

describe('DocumentPermissionService', () => {
    beforeEach(() => {
        resetMocks()
    })

    describe('getPermission', () => {
        it('returns existing permission level', async () => {
            mockModels.documentPermission.findByEntityAndBucket.mockResolvedValueOnce({ permission_level: PermissionLevel.VIEW })

            const perm = await service.getPermission('user', 'u1', 'b1')

            expect(perm).toBe(PermissionLevel.VIEW)
        })

        it('falls back to NONE when not found', async () => {
            mockModels.documentPermission.findByEntityAndBucket.mockResolvedValueOnce(undefined)

            const perm = await service.getPermission('user', 'u1', 'b1')

            expect(perm).toBe(PermissionLevel.NONE)
        })
    })

    describe('setPermission', () => {
        it('updates existing record and audits actor', async () => {
            mockModels.documentPermission.findByEntityAndBucket.mockResolvedValueOnce({ id: 'p1' })
            const actor = { id: 'admin', email: 'a@example.com', ip: '1.1.1.1' }

            await service.setPermission('user', 'u1', 'b1', PermissionLevel.UPLOAD, actor)

            expect(mockModels.documentPermission.update).toHaveBeenCalledWith('p1', { permission_level: PermissionLevel.UPLOAD, updated_by: actor.id })
            expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
                resourceId: 'user:u1:b1',
                details: { entityType: 'user', entityId: 'u1', bucketId: 'b1', level: PermissionLevel.UPLOAD },
                ipAddress: '1.1.1.1',
            }))
        })

        it('creates record when missing', async () => {
            mockModels.documentPermission.findByEntityAndBucket.mockResolvedValueOnce(undefined)

            await service.setPermission('team', 't1', 'b2', PermissionLevel.VIEW)

            expect(mockModels.documentPermission.create).toHaveBeenCalledWith({
                entity_type: 'team',
                entity_id: 't1',
                bucket_id: 'b2',
                permission_level: PermissionLevel.VIEW,
                created_by: null,
                updated_by: null
            })
            expect(mockAudit.log).not.toHaveBeenCalled()
        })

        it('logs and rethrows errors', async () => {
            mockModels.documentPermission.findByEntityAndBucket.mockResolvedValueOnce({ id: 'p1' })
            mockModels.documentPermission.update.mockRejectedValueOnce(new Error('fail'))

            await expect(service.setPermission('user', 'u1', 'b1', PermissionLevel.FULL)).rejects.toThrow('fail')
            expect(mockLog.error).toHaveBeenCalledWith('Failed to set permission', { error: 'Error: fail' })
        })
    })

    describe('resolveUserPermission', () => {
        it('returns FULL for admin without further checks', async () => {
            mockModels.user.findById.mockResolvedValueOnce({ role: 'admin' })

            const perm = await service.resolveUserPermission('admin', 'b1')

            expect(perm).toBe(PermissionLevel.FULL)
            expect(mockModels.userTeam.findAll).not.toHaveBeenCalled()
        })

        it('combines user and leader team permissions taking max', async () => {
            mockModels.user.findById.mockResolvedValueOnce({ role: 'user' })
            mockModels.userTeam.findAll.mockResolvedValueOnce([{ team_id: 't1', role: 'leader' }])
            const permSpy = vi.spyOn(service, 'getPermission').mockImplementation(async (entityType: string) => {
                if (entityType === 'user') return PermissionLevel.NONE
                return PermissionLevel.FULL
            })

            const perm = await service.resolveUserPermission('u1', 'b1')

            expect(perm).toBe(PermissionLevel.FULL)
            expect(permSpy).toHaveBeenCalledWith('team', 't1', 'b1')
            permSpy.mockRestore()
        })

        it('returns user permission when no leader teams', async () => {
            mockModels.user.findById.mockResolvedValueOnce({ role: 'user' })
            mockModels.userTeam.findAll.mockResolvedValueOnce([])
            vi.spyOn(service, 'getPermission').mockResolvedValueOnce(PermissionLevel.UPLOAD)

            const perm = await service.resolveUserPermission('u1', 'b1')

            expect(perm).toBe(PermissionLevel.UPLOAD)
        })
    })

    describe('getPermissions', () => {
        it('returns bucket scoped permissions', async () => {
            mockModels.documentPermission.findAll.mockResolvedValueOnce([{ id: 'p1' }])

            const perms = await service.getPermissions('b1')

            expect(perms).toEqual([{ id: 'p1' }])
            expect(mockModels.documentPermission.findAll).toHaveBeenCalledWith({ bucket_id: 'b1' })
        })
    })

    describe('setPermissions', () => {
        it('applies batch permissions', async () => {
            const spy = vi.spyOn(service, 'setPermission').mockResolvedValue()
            const actor = { id: 'u', email: 'e' }

            await service.setPermissions('bucket', [
                { entityType: 'user', entityId: 'u1', level: PermissionLevel.VIEW },
                { entityType: 'team', entityId: 't1', level: PermissionLevel.UPLOAD },
            ], actor)

            expect(spy).toHaveBeenCalledTimes(2)
            expect(spy).toHaveBeenCalledWith('team', 't1', 'bucket', PermissionLevel.UPLOAD, actor)
            spy.mockRestore()
        })
    })

    describe('getAllPermissions', () => {
        it('delegates to bucket-scoped fetch when bucket provided', async () => {
            const spy = vi.spyOn(service, 'getPermissions').mockResolvedValue([])

            await service.getAllPermissions('b1')

            expect(spy).toHaveBeenCalledWith('b1')
            spy.mockRestore()
        })

        it('returns all permissions when no bucket id', async () => {
            mockModels.documentPermission.findAll.mockResolvedValueOnce([{ id: 'p1' }])

            const perms = await service.getAllPermissions()

            expect(perms).toEqual([{ id: 'p1' }])
            expect(mockModels.documentPermission.findAll).toHaveBeenCalled()
        })
    })
})
