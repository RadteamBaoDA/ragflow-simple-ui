/**
 * @fileoverview Unit tests for TeamController.
 * Mocks TeamService to verify request handling, response formatting, and error states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TeamController } from '../../src/modules/teams/teams.controller.js'
import { createMockRequest, createMockResponse } from '../setup'

// Hoist mocks
const mocks = vi.hoisted(() => ({
  mockTeamService: {
    getAllTeams: vi.fn(),
    createTeam: vi.fn(),
    getTeam: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
    getTeamMembers: vi.fn(),
    addMembersWithAutoRole: vi.fn(),
    removeUserFromTeam: vi.fn(),
    grantPermissionsToTeam: vi.fn(),
  },
  mockGetClientIp: vi.fn(() => '127.0.0.1'),
}))

vi.mock('@/modules/teams/team.service.js', () => ({
  teamService: mocks.mockTeamService,
}))

vi.mock('@/shared/utils/ip.js', () => ({
  getClientIp: mocks.mockGetClientIp,
}))

describe('TeamController', () => {
  let controller: TeamController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new TeamController()
  })

  describe('getTeams', () => {
    it('returns all teams', async () => {
      const teams = [{ id: 't1', name: 'Team 1' }]
      mocks.mockTeamService.getAllTeams.mockResolvedValueOnce(teams)

      const req = createMockRequest()
      const res = createMockResponse()

      await controller.getTeams(req, res)

      expect(res.json).toHaveBeenCalledWith(teams)
    })

    it('handles service errors', async () => {
      mocks.mockTeamService.getAllTeams.mockRejectedValueOnce(new Error('Fail'))
      
      const req = createMockRequest()
      const res = createMockResponse()

      await controller.getTeams(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('createTeam', () => {
    it('successfully creates a team with user context', async () => {
      const team = { id: 't1', name: 'New' }
      mocks.mockTeamService.createTeam.mockResolvedValueOnce(team)

      const req = createMockRequest({ 
        body: { name: 'New' },
        user: { id: 'u1', email: 'u1@test.com' }
      })
      const res = createMockResponse()

      await controller.createTeam(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(team)
      expect(mocks.mockTeamService.createTeam).toHaveBeenCalledWith(
        { name: 'New' },
        expect.objectContaining({ id: 'u1' })
      )
    })
  })

  describe('updateTeam', () => {
    it('updates team and returns results', async () => {
      const updated = { id: 't1', name: 'Updated' }
      mocks.mockTeamService.updateTeam.mockResolvedValueOnce(updated)

      const req = createMockRequest({ 
        params: { id: 't1' },
        body: { name: 'Updated' }
      })
      const res = createMockResponse()

      await controller.updateTeam(req, res)

      expect(res.json).toHaveBeenCalledWith(updated)
    })

    it('returns 404 if team not found', async () => {
      mocks.mockTeamService.updateTeam.mockResolvedValueOnce(null)

      const req = createMockRequest({ params: { id: 'none' } })
      const res = createMockResponse()

      await controller.updateTeam(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
    })
  })

  describe('addMembers', () => {
    it('adds multiple members successfully', async () => {
      const req = createMockRequest({
        params: { id: 't1' },
        body: { userIds: ['u1', 'u2'] },
        user: { id: 'u1' }
      })
      const res = createMockResponse()

      await controller.addMembers(req, res)

      expect(mocks.mockTeamService.addMembersWithAutoRole).toHaveBeenCalledWith(
        't1',
        ['u1', 'u2'],
        expect.objectContaining({ id: 'u1' })
      )
      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('returns 400 if userIds missing', async () => {
      const req = createMockRequest({ params: { id: 't1' }, body: {} })
      const res = createMockResponse()

      await controller.addMembers(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })
  })

  describe('grantPermissions', () => {
    it('grants permissions successfully', async () => {
      const req = createMockRequest({
        params: { id: 't1' },
        body: { permissions: ['read', 'write'] },
        user: { id: 'u1' }
      })
      const res = createMockResponse()

      await controller.grantPermissions(req, res)

      expect(mocks.mockTeamService.grantPermissionsToTeam).toHaveBeenCalledWith(
        't1',
        ['read', 'write'],
        expect.objectContaining({ id: 'u1' })
      )
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.anything() }))
    })
  })
})
