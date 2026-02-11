/**
 * @fileoverview Unit tests for TeamService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist all mocks and variables needed for mocking
const mocks = vi.hoisted(() => {
  const knex: any = {
    where: vi.fn(),
    whereNot: vi.fn(),
    first: vi.fn(),
  }
  knex.where.mockReturnValue(knex)
  knex.whereNot.mockReturnValue(knex)

  return {
    mockKnex: knex,
    mockUpdateUserPermissions: vi.fn(),
    mockTeam: {
      create: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getKnex: vi.fn(() => knex),
    },
    mockUserTeam: {
      upsert: vi.fn(),
      deleteByUserAndTeam: vi.fn(),
      findMembersByTeamId: vi.fn(),
      findTeamsWithDetailsByUserId: vi.fn(),
      findUsersByIds: vi.fn(),
    },
    mockUser: {
      findById: vi.fn(),
    },
    mockAudit: {
      log: vi.fn(),
    },
    mockLog: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }
})

// Extract for easier use in tests
const { mockTeam, mockUserTeam, mockUser, mockAudit, mockLog, mockKnex, mockUpdateUserPermissions } = mocks

vi.mock('@/shared/models/factory.js', () => ({
  ModelFactory: {
    team: mocks.mockTeam,
    userTeam: mocks.mockUserTeam,
    user: mocks.mockUser,
  },
}))

vi.mock('@/shared/services/logger.service.js', () => ({
  log: mocks.mockLog,
}))

vi.mock('@/modules/audit/audit.service.js', () => ({
  auditService: mocks.mockAudit,
  AuditAction: {
    CREATE_TEAM: 'CREATE_TEAM',
    UPDATE_TEAM: 'UPDATE_TEAM',
    DELETE_TEAM: 'DELETE_TEAM',
  },
  AuditResourceType: { TEAM: 'TEAM' },
}))

vi.mock('@/modules/users/user.service.js', () => ({
  userService: { updateUserPermissions: mocks.mockUpdateUserPermissions }
}))

vi.mock('uuid', () => ({
  v4: () => 'test-uuid',
}))

// Lazy import service to ensure mocks apply
import { TeamService } from '../../src/modules/teams/team.service.js'

describe('TeamService', () => {
  let teamService: TeamService

  beforeEach(() => {
    vi.clearAllMocks()
    teamService = new TeamService()
    
    // Ensure getKnex always returns the mock knex
    mockTeam.getKnex.mockReturnValue(mockKnex)
    mockKnex.where.mockReturnValue(mockKnex)
    mockKnex.whereNot.mockReturnValue(mockKnex)
  })

  describe('createTeam', () => {
    const user = { id: 'u1', email: 'u1@test.com', ip: '127.0.0.1' }
    const dto = { name: 'Team A', project_name: 'Project 1', description: 'Desc' }

    it('successfully creates a team', async () => {
      mockKnex.first.mockResolvedValueOnce(null)
      mockTeam.create.mockResolvedValueOnce({ id: 'test-uuid', ...dto })

      const result = await teamService.createTeam(dto, user)

      expect(result.id).toBe('test-uuid')
      expect(mockTeam.create).toHaveBeenCalled()
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATE_TEAM',
        resourceId: 'test-uuid'
      }))
    })

    it('throws error if team name already exists in project', async () => {
      mockKnex.first.mockResolvedValueOnce({ id: 'existing' })
      
      await expect(teamService.createTeam(dto, user)).rejects.toThrow(/already exists/)
    })
  })

  describe('getAllTeams', () => {
    it('returns enriched teams with member count and leader', async () => {
      const teams = [{ id: 't1', name: 'Team 1' }]
      mockTeam.findAll.mockResolvedValueOnce(teams)
      mockUserTeam.findMembersByTeamId.mockResolvedValueOnce([
        { id: 'u1', display_name: 'L1', email: 'l@t.com', role: 'leader', joined_at: '2025-01-01' },
        { id: 'u2', display_name: 'M1', email: 'm@t.com', role: 'member', joined_at: '2025-01-02' }
      ])

      const result = await teamService.getAllTeams()

      expect(result).toHaveLength(1)
      expect(result[0].member_count).toBe(2)
      expect(result[0].leader.id).toBe('u1')
    })
  })

  describe('updateTeam', () => {
    const user = { id: 'u1', email: 'u1@test.com' }
    const dto = { name: 'Updated Team' }

    it('successfully updates a team', async () => {
      mockTeam.findById.mockResolvedValueOnce({ id: 't1', name: 'Old' })
      mockKnex.first.mockResolvedValueOnce(null)
      mockTeam.update.mockResolvedValueOnce({ id: 't1', name: 'Updated Team' })

      const result = await teamService.updateTeam('t1', dto, user)

      expect(result.name).toBe('Updated Team')
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE_TEAM'
      }))
    })
  })

  describe('addUserToTeam / removeUserFromTeam', () => {
    const actor = { id: 'u1', email: 'u1@test.com' }

    it('adds user to team', async () => {
      await teamService.addUserToTeam('t1', 'u2', 'member', actor)
      expect(mockUserTeam.upsert).toHaveBeenCalledWith('u2', 't1', 'member', 'u1')
      expect(mockAudit.log).toHaveBeenCalled()
    })

    it('removes user from team', async () => {
      await teamService.removeUserFromTeam('t1', 'u2', actor)
      expect(mockUserTeam.deleteByUserAndTeam).toHaveBeenCalledWith('u2', 't1')
      expect(mockAudit.log).toHaveBeenCalled()
    })
  })

  describe('addMembersWithAutoRole', () => {
    const actor = { id: 'u1', email: 'u1@test.com' }

    it('maps leader global role to leader team role', async () => {
      mockUserTeam.findUsersByIds.mockResolvedValueOnce([
        { id: 'u2', role: 'leader' },
        { id: 'u3', role: 'user' }
      ])

      await teamService.addMembersWithAutoRole('t1', ['u2', 'u3'], actor)

      expect(mockUserTeam.upsert).toHaveBeenCalledWith('u2', 't1', 'leader', 'u1')
      expect(mockUserTeam.upsert).toHaveBeenCalledWith('u3', 't1', 'member', 'u1')
    })

    it('throws if admin is included', async () => {
      mockUserTeam.findUsersByIds.mockResolvedValueOnce([{ id: 'u2', role: 'admin' }])
      await expect(teamService.addMembersWithAutoRole('t1', ['u2'], actor))
        .rejects.toThrow('Administrators cannot be added to teams')
    })
  })

  describe('grantPermissionsToTeam', () => {
    it('merges and updates permissions for team members', async () => {
      mockUserTeam.findMembersByTeamId.mockResolvedValueOnce([{ id: 'u2' }])
      mockUser.findById.mockResolvedValueOnce({ id: 'u2', role: 'user', permissions: ['read'] })
      
      await teamService.grantPermissionsToTeam('t1', ['write'])

      expect(mockUpdateUserPermissions).toHaveBeenCalledWith('u2', ['read', 'write'], undefined)
    })
  })
})
