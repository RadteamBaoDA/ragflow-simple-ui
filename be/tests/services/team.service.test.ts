
/**
 * @fileoverview Unit tests for TeamService with ModelFactory mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TeamService } from '../../src/services/team.service.js'

vi.mock('uuid', () => ({ v4: () => 'uuid-1' }))

// Define createQueryBuilder outside hoisted
function createTeamQueryBuilder() {
    const qb = {} as any;
    // Set methods after creating the object to avoid "qb not initialized" error
    qb.where = vi.fn().mockReturnValue(qb);
    qb.andWhere = vi.fn().mockReturnValue(qb);
    qb.whereNot = vi.fn().mockReturnValue(qb);
    qb.first = vi.fn().mockResolvedValue(undefined);
    qb.orderBy = vi.fn().mockReturnValue(qb);
    return qb;
}

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
        CREATE_TEAM: 'create_team',
        UPDATE_TEAM: 'update_team',
        DELETE_TEAM: 'delete_team',
    },
    AuditResourceType: {
        TEAM: 'team',
    },
}))

const mockUserService = vi.hoisted(() => ({
    updateUserPermissions: vi.fn(),
}))

vi.mock('../../src/services/user.service.js', () => ({
    userService: mockUserService,
}))

const mockModels = vi.hoisted(() => {
    return {
        team: {
            create: vi.fn(),
            findAll: vi.fn(),
            findById: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            getKnex: vi.fn(),
        },
        userTeam: {
            upsert: vi.fn(),
            deleteByUserAndTeam: vi.fn(),
            findMembersByTeamId: vi.fn(),
            findTeamsWithDetailsByUserId: vi.fn(),
            findUsersByIds: vi.fn(),
        },
        user: {
            findById: vi.fn(),
        },
    }
})

vi.mock('../../src/models/factory.js', () => ({
    ModelFactory: mockModels,
}))

const service = new TeamService()

const resetMocks = () => {
    // Reset individual mocks but preserve implementations
    mockModels.team.create.mockReset()
    mockModels.team.findAll.mockReset()
    mockModels.team.findById.mockReset()
    mockModels.team.update.mockReset()
    mockModels.team.delete.mockReset()
    mockModels.team.getKnex.mockReset()
    mockModels.team.getKnex.mockImplementation(createTeamQueryBuilder)
    
    mockModels.userTeam.upsert.mockReset()
    mockModels.userTeam.deleteByUserAndTeam.mockReset()
    mockModels.userTeam.findMembersByTeamId.mockReset()
    mockModels.userTeam.findTeamsWithDetailsByUserId.mockReset()
    mockModels.userTeam.findUsersByIds.mockReset()
    
    mockModels.user.findById.mockReset()
    mockAudit.log.mockReset()
    mockLog.error.mockReset()
    mockUserService.updateUserPermissions.mockReset()
}

describe('TeamService', () => {
    beforeEach(() => {
        resetMocks()
    })

    describe('createTeam', () => {
        it('creates team with uuid and audits actor', async () => {
            mockModels.team.create.mockResolvedValueOnce({ id: 'uuid-1', name: 'Team' })
            const user = { id: 'u1', email: 'e@example.com', ip: '1.1.1.1' }

            const result = await service.createTeam({ name: 'Team' }, user)

            expect(mockModels.team.create).toHaveBeenCalledWith({ id: 'uuid-1', name: 'Team', project_name: null, description: null, created_by: 'u1', updated_by: 'u1' })
            expect(result.id).toBe('uuid-1')
            expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'create_team',
                resourceType: 'team',
                resourceId: 'uuid-1',
                userId: 'u1',
                ipAddress: '1.1.1.1',
            }))
        })
    })

    describe('getters', () => {
        it('fetches all teams ordered', async () => {
            mockModels.team.findAll.mockResolvedValueOnce([{ id: 't1' }])
            mockModels.userTeam.findMembersByTeamId.mockResolvedValueOnce([])

            const res = await service.getAllTeams()

            expect(res).toEqual([{ id: 't1', member_count: 0, leader: null }])
            expect(mockModels.team.findAll).toHaveBeenCalledWith({}, { orderBy: { created_at: 'desc' } })
        })

        it('fetches single team by id', async () => {
            mockModels.team.findById.mockResolvedValueOnce({ id: 't1' })

            const res = await service.getTeam('t1')

            expect(res?.id).toBe('t1')
        })
    })

    describe('updateTeam', () => {
        it('returns existing team when no changes provided', async () => {
            const spy = vi.spyOn(service, 'getTeam').mockResolvedValueOnce({ id: 't1' } as any)

            const res = await service.updateTeam('t1', {})

            expect(res?.id).toBe('t1')
            expect(mockModels.team.update).not.toHaveBeenCalled()
            spy.mockRestore()
        })

        it('updates provided fields and audits', async () => {
            mockModels.team.update.mockResolvedValueOnce({ id: 't1', name: 'New' })
            const user = { id: 'u1', email: 'e@example.com', ip: '1.1.1.1' }

            const res = await service.updateTeam('t1', { name: 'New', description: 'Desc' }, user)

            expect(mockModels.team.update).toHaveBeenCalledWith('t1', { name: 'New', description: 'Desc', updated_by: 'u1' })
            expect(res?.name).toBe('New')
            expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'update_team', resourceId: 't1' }))
        })
    })

    describe('deleteTeam', () => {
        it('deletes team and audits with name', async () => {
            const spy = vi.spyOn(service, 'getTeam').mockResolvedValueOnce({ id: 't1', name: 'Old' } as any)
            const user = { id: 'u1', email: 'e@example.com', ip: '1.1.1.1' }

            await service.deleteTeam('t1', user)

            expect(mockModels.team.delete).toHaveBeenCalledWith('t1')
            expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'delete_team',
                resourceId: 't1',
                details: { teamName: 'Old' },
            }))
            spy.mockRestore()
        })
    })

    describe('membership mutations', () => {
        it('adds user with role and audits', async () => {
            const actor = { id: 'admin', email: 'a@example.com', ip: '2.2.2.2' }

            await service.addUserToTeam('t1', 'u2', 'member', actor)

            expect(mockModels.userTeam.upsert).toHaveBeenCalledWith('u2', 't1', 'member', actor.id)
            expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'update_team',
                resourceId: 't1',
                details: { action: 'add_member', targetUserId: 'u2', role: 'member' },
            }))
        })

        it('removes user and audits', async () => {
            const actor = { id: 'admin', email: 'a@example.com', ip: '2.2.2.2' }

            await service.removeUserFromTeam('t1', 'u2', actor)

            expect(mockModels.userTeam.deleteByUserAndTeam).toHaveBeenCalledWith('u2', 't1')
            expect(mockAudit.log).toHaveBeenCalled()
        })
    })

    describe('queries', () => {
        it('lists team members', async () => {
            mockModels.userTeam.findMembersByTeamId.mockResolvedValueOnce([{ id: 'u1' }])

            const members = await service.getTeamMembers('t1')

            expect(members).toEqual([{ id: 'u1' }])
            expect(mockModels.userTeam.findMembersByTeamId).toHaveBeenCalledWith('t1')
        })

        it('lists user teams with details', async () => {
            mockModels.userTeam.findTeamsWithDetailsByUserId.mockResolvedValueOnce([{ id: 't1' }])

            const teams = await service.getUserTeams('u1')

            expect(teams).toEqual([{ id: 't1' }])
        })
    })

    describe('addMembersWithAutoRole', () => {
        it('no-ops when empty input', async () => {
            await service.addMembersWithAutoRole('t1', [])

            expect(mockModels.userTeam.findUsersByIds).not.toHaveBeenCalled()
        })

        it('throws when admins included', async () => {
            mockModels.userTeam.findUsersByIds.mockResolvedValueOnce([{ id: 'a', role: 'admin' }])

            await expect(service.addMembersWithAutoRole('t1', ['a'])).rejects.toThrow('Administrators cannot be added to teams')
        })

        it('adds leaders and members with mapped roles', async () => {
            mockModels.userTeam.findUsersByIds.mockResolvedValueOnce([
                { id: 'l1', role: 'leader' },
                { id: 'u2', role: 'user' },
            ])
            const spy = vi.spyOn(service, 'addUserToTeam').mockResolvedValue()
            const actor = { id: 'admin', email: 'a@example.com' }

            await service.addMembersWithAutoRole('t1', ['l1', 'u2'], actor)

            expect(spy).toHaveBeenCalledWith('t1', 'l1', 'leader', actor)
            expect(spy).toHaveBeenCalledWith('t1', 'u2', 'member', actor)
            spy.mockRestore()
        })
    })

    describe('grantPermissionsToTeam', () => {
        it('skips when no members', async () => {
            const membersSpy = vi.spyOn(service, 'getTeamMembers').mockResolvedValueOnce([] as any)

            await service.grantPermissionsToTeam('t1', ['perm1'])

            expect(mockModels.user.findById).not.toHaveBeenCalled()
            membersSpy.mockRestore()
        })

        it('updates non-admin members when permissions change', async () => {
            const membersSpy = vi.spyOn(service, 'getTeamMembers').mockResolvedValueOnce([{ id: 'u1' }] as any)
            mockModels.user.findById.mockResolvedValueOnce({ id: 'u1', role: 'user', permissions: JSON.stringify(['p1']) })

            await service.grantPermissionsToTeam('t1', ['p1', 'p2'], { id: 'actor', email: 'e' })

            expect(mockUserService.updateUserPermissions).toHaveBeenCalledWith('u1', ['p1', 'p2'], { id: 'actor', email: 'e' })
            membersSpy.mockRestore()
        })

        it('does not update if permissions unchanged or admin member', async () => {
            const membersSpy = vi.spyOn(service, 'getTeamMembers').mockResolvedValueOnce([{ id: 'u1' }, { id: 'a1' }] as any)
            mockModels.user.findById.mockResolvedValueOnce({ id: 'u1', role: 'user', permissions: ['p1'] })
            mockModels.user.findById.mockResolvedValueOnce({ id: 'a1', role: 'admin' })

            await service.grantPermissionsToTeam('t1', ['p1'], { id: 'actor', email: 'e' })

            expect(mockUserService.updateUserPermissions).toHaveBeenCalledTimes(0)
            membersSpy.mockRestore()
        })
    })
})
