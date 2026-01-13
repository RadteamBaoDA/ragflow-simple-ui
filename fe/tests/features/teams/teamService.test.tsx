import { describe, it, expect, vi, beforeEach } from 'vitest'
import { teamService } from '../../../src/features/teams/api/teamService'

describe('teamService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
  })

  it('fetches teams', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([{ id: '1', name: 'Team A' }])))
    )
    const result = await teamService.getTeams()
    expect(result).toEqual([{ id: '1', name: 'Team A' }])
  })

  it('creates team', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ id: '1', name: 'New Team' })))
    )
    const result = await teamService.createTeam({ name: 'New Team' })
    expect(result).toHaveProperty('id')
  })

  it('updates team', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ id: '1', name: 'Updated' })))
    )
    const result = await teamService.updateTeam('1', { name: 'Updated' })
    expect(result.name).toBe('Updated')
  })

  it('deletes team', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null)))
    await teamService.deleteTeam('1')
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/teams/1'), expect.objectContaining({ method: 'DELETE' }))
  })

  it('fetches team members', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([{ id: '1', email: 'user@e.com', display_name: 'User', role: 'member' }])))
    )
    const result = await teamService.getTeamMembers('1')
    expect(result).toHaveLength(1)
  })

  it('adds team member', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null)))
    await teamService.addMembers('1', ['2'])
    expect(global.fetch).toHaveBeenCalled()
  })

  it('removes team member', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null)))
    await teamService.removeMember('1', '2')
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/teams/1/members/2'), expect.objectContaining({ method: 'DELETE' }))
  })

  it('includes authorization header', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify([]))))
    await teamService.getTeams()
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }))
  })

  it('handles fetch errors', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 500 })))
    try {
      await teamService.getTeams()
    } catch (e) {
      expect((e as Error).message).toContain('Failed')
    }
  })

  it('includes credentials', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify([]))))
    await teamService.getTeams()
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ credentials: 'include' }))
  })

  it('handles grantPermissions request', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null)))
    await teamService.grantPermissions('1', ['read', 'write'])
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/teams/1/permissions'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ permissions: ['read', 'write'] })
      })
    )
  })

  it('handles createTeam error', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 400 })))
    await expect(teamService.createTeam({ name: 'Test' })).rejects.toThrow('Failed to create team')
  })

  it('handles updateTeam error', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 404 })))
    await expect(teamService.updateTeam('1', { name: 'Updated' })).rejects.toThrow('Failed to update team')
  })

  it('handles deleteTeam error', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 403 })))
    await expect(teamService.deleteTeam('1')).rejects.toThrow('Failed to delete team')
  })

  it('handles getTeamMembers error', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 404 })))
    await expect(teamService.getTeamMembers('1')).rejects.toThrow('Failed to fetch team members')
  })

  it('handles removeMember error', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 403 })))
    await expect(teamService.removeMember('1', '2')).rejects.toThrow('Failed to remove member')
  })

  it('handles addMembers error with JSON response', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })))
    await expect(teamService.addMembers('1', ['2'])).rejects.toThrow('User not found')
  })

  it('handles addMembers error without JSON response', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('Bad Request', { status: 400 })))
    await expect(teamService.addMembers('1', ['2'])).rejects.toThrow('Failed to add members')
  })

  it('handles grantPermissions error', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 403 })))
    await expect(teamService.grantPermissions('1', ['read'])).rejects.toThrow('Failed to grant permissions')
  })
})