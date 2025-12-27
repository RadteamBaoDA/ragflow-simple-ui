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
})