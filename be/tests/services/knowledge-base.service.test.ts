
/**
 * @fileoverview Unit tests for KnowledgeBaseService with ModelFactory mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KnowledgeBaseService } from '../../src/services/knowledge-base.service.js'

const mockLog = vi.hoisted(() => ({
    error: vi.fn(),
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
        CREATE_SOURCE: 'create_source',
        UPDATE_SOURCE: 'update_source',
        DELETE_SOURCE: 'delete_source',
        UPDATE_CONFIG: 'update_config',
    },
    AuditResourceType: {
        CONFIG: 'config',
        KNOWLEDGE_BASE_SOURCE: 'knowledge_base_source',
    },
}))

const mockTeamService = vi.hoisted(() => ({
    getUserTeams: vi.fn(),
}))

vi.mock('../../src/services/team.service.js', () => ({
    teamService: mockTeamService,
}))

const mockModels = vi.hoisted(() => ({
    knowledgeBaseSource: {
        findAll: vi.fn(),
        findById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
    systemConfig: {
        findById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
}))

vi.mock('../../src/models/factory.js', () => ({
    ModelFactory: mockModels,
}))

const service = new KnowledgeBaseService()

const resetMocks = () => {
    vi.clearAllMocks()
    Object.values(mockModels.knowledgeBaseSource).forEach(fn => fn.mockReset())
    Object.values(mockModels.systemConfig).forEach(fn => fn.mockReset())
    mockTeamService.getUserTeams.mockReset()
    mockAudit.log.mockReset()
    mockLog.error.mockReset()
}

describe('KnowledgeBaseService', () => {
    beforeEach(() => {
        resetMocks()
        mockTeamService.getUserTeams.mockResolvedValue([])
    })

    describe('getAvailableSources', () => {
        it('returns only public sources when no user', async () => {
            mockModels.knowledgeBaseSource.findAll.mockResolvedValueOnce([
                { name: 'Public', access_control: { public: true } },
                { name: 'Private', access_control: { public: false } },
                { name: 'String', access_control: JSON.stringify({ public: true }) },
            ])

            const result = await service.getAvailableSources()

            expect(result.map(r => r.name)).toEqual(['Public', 'String'])
        })

        it('returns all sources for admin using ordered fetch', async () => {
            mockModels.knowledgeBaseSource.findAll.mockResolvedValueOnce([{ name: 'Any' }])

            const result = await service.getAvailableSources({ id: 'u1', role: 'admin' })

            expect(result).toEqual([{ name: 'Any' }])
            expect(mockModels.knowledgeBaseSource.findAll).toHaveBeenCalledWith({}, { orderBy: { name: 'asc' } })
        })

        it('filters by user id and team ids with sorting', async () => {
            mockTeamService.getUserTeams.mockResolvedValueOnce([{ id: 't1' }])
            mockModels.knowledgeBaseSource.findAll.mockResolvedValueOnce([
                { name: 'Z-Team', access_control: { public: false, user_ids: [], team_ids: ['t1'] } },
                { name: 'A-User', access_control: JSON.stringify({ public: false, user_ids: ['u1'], team_ids: [] }) },
                { name: 'NoAccess', access_control: { public: false, user_ids: [], team_ids: [] } },
                { name: 'Public', access_control: { public: true } },
            ])

            const result = await service.getAvailableSources({ id: 'u1', role: 'user' })

            expect(result.map(s => s.name)).toEqual(['A-User', 'Public', 'Z-Team'])
        })
    })

    describe('saveSystemConfig', () => {
        it('creates missing key and audits actor', async () => {
            mockModels.systemConfig.findById.mockResolvedValueOnce(undefined)
            const user = { id: 'u1', email: 'e@example.com', ip: '1.1.1.1' }

            await service.saveSystemConfig('defaultChatSourceId', 's1', user)

            expect(mockModels.systemConfig.create).toHaveBeenCalledWith({ key: 'defaultChatSourceId', value: 's1' })
            expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'u1',
                resourceId: 'defaultChatSourceId',
                details: { value: 's1' },
                ipAddress: '1.1.1.1',
            }))
        })

        it('updates existing key without audit when no user', async () => {
            mockModels.systemConfig.findById.mockResolvedValueOnce({ key: 'k', value: 'old' })

            await service.saveSystemConfig('k', 'new')

            expect(mockModels.systemConfig.update).toHaveBeenCalledWith('k', { value: 'new' })
            expect(mockAudit.log).not.toHaveBeenCalled()
        })
    })

    describe('createSource', () => {
        it('stringifies ACL, returns source, and audits', async () => {
            mockModels.knowledgeBaseSource.create.mockImplementationOnce(async payload => ({ id: 's1', ...payload }))
            const user = { id: 'u1', email: 'e@example.com', ip: '2.2.2.2' }

            const source = await service.createSource({ type: 'chat', name: 'Src', url: 'http', access_control: { public: true } }, user)

            expect(mockModels.knowledgeBaseSource.create).toHaveBeenCalledWith(expect.objectContaining({
                access_control: JSON.stringify({ public: true }),
            }))
            expect(source.id).toBe('s1')
            expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'create_source',
                resourceType: 'knowledge_base_source',
                resourceId: 's1',
                userId: 'u1',
                ipAddress: '2.2.2.2',
            }))
        })

        it('logs and rethrows when create fails', async () => {
            mockModels.knowledgeBaseSource.create.mockRejectedValueOnce(new Error('boom'))

            await expect(service.createSource({ type: 'chat', name: 'Src', url: 'http' })).rejects.toThrow('boom')
            expect(mockLog.error).toHaveBeenCalledWith('Failed to create knowledge base source in database', expect.any(Object))
        })
    })

    describe('updateSource', () => {
        it('sends only provided fields and audits', async () => {
            mockModels.knowledgeBaseSource.update.mockResolvedValueOnce({ id: 's1', name: 'Updated' })
            const user = { id: 'u1', email: 'e@example.com', ip: '3.3.3.3' }

            const result = await service.updateSource('s1', { name: 'Updated', access_control: { public: false } }, user)

            expect(mockModels.knowledgeBaseSource.update).toHaveBeenCalledWith('s1', {
                name: 'Updated',
                access_control: JSON.stringify({ public: false }),
            })
            expect(result?.name).toBe('Updated')
            expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'update_source', resourceId: 's1' }))
        })

        it('logs and rethrows on update error', async () => {
            mockModels.knowledgeBaseSource.update.mockRejectedValueOnce(new Error('fail'))

            await expect(service.updateSource('s1', { name: 'Bad' })).rejects.toThrow('fail')
            expect(mockLog.error).toHaveBeenCalledWith('Failed to update knowledge base source in database', expect.any(Object))
        })
    })

    describe('deleteSource', () => {
        it('deletes source and audits with existing name', async () => {
            mockModels.knowledgeBaseSource.findById.mockResolvedValueOnce({ id: 's1', name: 'Old' })
            const user = { id: 'u1', email: 'e@example.com', ip: '4.4.4.4' }

            await service.deleteSource('s1', user)

            expect(mockModels.knowledgeBaseSource.delete).toHaveBeenCalledWith('s1')
            expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'delete_source',
                details: { name: 'Old' },
            }))
        })
    })

    describe('getConfig', () => {
        it('splits chat/search sources and uses defaults', async () => {
            mockModels.knowledgeBaseSource.findAll.mockResolvedValueOnce([
                { id: 'c1', type: 'chat', name: 'Chat', access_control: { public: true } },
                { id: 's1', type: 'search', name: 'Search', access_control: { public: true } },
            ])
            mockModels.systemConfig.findById.mockImplementation(async key => ({ key, value: `${key}-val` }))

            const result = await service.getConfig({ id: 'u', role: 'user' })

            expect(result.chatSources.map((c: any) => c.id)).toEqual(['c1'])
            expect(result.searchSources.map((s: any) => s.id)).toEqual(['s1'])
            expect(result.defaultChatSourceId).toBe('defaultChatSourceId-val')
            expect(result.defaultSearchSourceId).toBe('defaultSearchSourceId-val')
        })
    })

    describe('updateConfig', () => {
        it('persists provided defaults via saveSystemConfig', async () => {
            const spy = vi.spyOn(service, 'saveSystemConfig').mockResolvedValue()

            await service.updateConfig({ defaultChatSourceId: 'c1', defaultSearchSourceId: 's1' }, { id: 'u1' })

            expect(spy).toHaveBeenCalledWith('defaultChatSourceId', 'c1', expect.any(Object))
            expect(spy).toHaveBeenCalledWith('defaultSearchSourceId', 's1', expect.any(Object))
            spy.mockRestore()
        })
    })
})
