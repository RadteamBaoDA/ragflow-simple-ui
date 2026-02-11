/**
 * @fileoverview Unit tests for teamApi.
 * Mocks the central api utility to verify endpoint URLs and request payloads.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { teamApi } from '@/features/teams/api/teamApi'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('teamApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getTeams calls api.get with correct URL', async () => {
    const mockTeams = [{ id: '1', name: 'Team A' }]
    vi.mocked(api.get).mockResolvedValueOnce(mockTeams)

    const result = await teamApi.getTeams()

    expect(api.get).toHaveBeenCalledWith('/api/teams')
    expect(result).toEqual(mockTeams)
  })

  it('createTeam calls api.post with correct payload', async () => {
    const dto = { name: 'New Team', project_name: 'Project X' }
    vi.mocked(api.post).mockResolvedValueOnce({ id: '1', ...dto })

    const result = await teamApi.createTeam(dto)

    expect(api.post).toHaveBeenCalledWith('/api/teams', dto)
    expect(result.name).toBe('New Team')
  })

  it('updateTeam calls api.put with correct URL and payload', async () => {
    const dto = { name: 'Updated' }
    vi.mocked(api.put).mockResolvedValueOnce({ id: '1', ...dto })

    await teamApi.updateTeam('1', dto)

    expect(api.put).toHaveBeenCalledWith('/api/teams/1', dto)
  })

  it('deleteTeam calls api.delete', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce(undefined)

    await teamApi.deleteTeam('1')

    expect(api.delete).toHaveBeenCalledWith('/api/teams/1')
  })

  it('getTeamMembers calls correct endpoint', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([])

    await teamApi.getTeamMembers('t1')

    expect(api.get).toHaveBeenCalledWith('/api/teams/t1/members')
  })

  it('addMembers calls api.post with userIds', async () => {
    await teamApi.addMembers('t1', ['u1', 'u2'])
    expect(api.post).toHaveBeenCalledWith('/api/teams/t1/members', { userIds: ['u1', 'u2'] })
  })

  it('removeMember calls api.delete with member path', async () => {
    await teamApi.removeMember('t1', 'u1')
    expect(api.delete).toHaveBeenCalledWith('/api/teams/t1/members/u1')
  })

  it('grantPermissions calls permissions endpoint', async () => {
    await teamApi.grantPermissions('t1', ['read', 'write'])
    expect(api.post).toHaveBeenCalledWith('/api/teams/t1/permissions', { permissions: ['read', 'write'] })
  })
})
