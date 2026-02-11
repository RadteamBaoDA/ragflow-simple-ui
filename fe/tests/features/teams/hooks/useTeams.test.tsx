/**
 * @fileoverview Unit tests for the useTeams hook.
 * Verifies team list fetching, filtering, pagination, and CRUD operation side effects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { teamApi } from '@/features/teams/api/teamApi'
import { globalMessage } from '@/app/App'

// Mock dependencies
vi.mock('@/features/teams/api/teamApi', () => ({
  teamApi: {
    getTeams: vi.fn(),
    createTeam: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/app/App', () => ({
  globalMessage: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockConfirm = vi.fn()
vi.mock('@/components/ConfirmDialog', () => ({
  useConfirm: () => mockConfirm,
}))

describe('useTeams', () => {
  const mockTeams = [
    { id: '1', name: 'Team A', project_name: 'P1' },
    { id: '2', name: 'Team B', project_name: 'P2' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(teamApi.getTeams).mockResolvedValue(mockTeams)
  })

  it('initially loads teams', async () => {
    const { result } = renderHook(() => useTeams())

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.teams).toEqual(mockTeams)
    expect(teamApi.getTeams).toHaveBeenCalledTimes(1)
  })

  it('handles search filtering', async () => {
    const { result } = renderHook(() => useTeams())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.handleSearch('Team A')
    })
    
    expect(result.current.paginatedTeams).toHaveLength(1)
    expect(result.current.paginatedTeams[0].name).toBe('Team A')
  })

  it('handles project filtering', async () => {
    const { result } = renderHook(() => useTeams())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.handleProjectFilter('P2')
    })

    expect(result.current.paginatedTeams).toHaveLength(1)
    expect(result.current.paginatedTeams[0].project_name).toBe('P2')
    expect(result.current.uniqueProjects).toEqual(['P1', 'P2'])
  })

  it('creates and refreshes teams', async () => {
    vi.mocked(teamApi.createTeam).mockResolvedValueOnce({ id: '3', name: 'New' } as any)
    const { result } = renderHook(() => useTeams())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let success = false
    await act(async () => {
      success = await result.current.createTeam({ name: 'New' } as any)
    })
    
    expect(success).toBe(true)
    expect(teamApi.createTeam).toHaveBeenCalledWith({ name: 'New' })
    expect(globalMessage.success).toHaveBeenCalled()
    // Should call getTeams again
    expect(teamApi.getTeams).toHaveBeenCalledTimes(2)
  })

  it('deletes team after confirmation', async () => {
    mockConfirm.mockResolvedValueOnce(true)
    vi.mocked(teamApi.deleteTeam).mockResolvedValueOnce(undefined)
    
    const { result } = renderHook(() => useTeams())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteTeam('1')
    })

    expect(mockConfirm).toHaveBeenCalled()
    expect(teamApi.deleteTeam).toHaveBeenCalledWith('1')
    expect(globalMessage.success).toHaveBeenCalled()
  })

  it('does not delete if cancelled', async () => {
    mockConfirm.mockResolvedValueOnce(false)
    
    const { result } = renderHook(() => useTeams())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await result.current.deleteTeam('1')

    expect(teamApi.deleteTeam).not.toHaveBeenCalled()
  })
})
