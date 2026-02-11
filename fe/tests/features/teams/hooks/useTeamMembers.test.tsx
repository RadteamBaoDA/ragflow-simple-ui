/**
 * @fileoverview Unit tests for the useTeamMembers hook.
 * Verifies member listing, adding/removing members, and available user filtering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTeamMembers } from '@/features/teams/hooks/useTeamMembers'
import { teamApi } from '@/features/teams/api/teamApi'
import { userApi } from '@/features/users'
import { globalMessage } from '@/app/App'

// Mock dependencies
vi.mock('@/features/teams/api/teamApi', () => ({
  teamApi: {
    getTeamMembers: vi.fn(),
    addMembers: vi.fn(),
    removeMember: vi.fn(),
  },
}))

vi.mock('@/features/users', () => ({
  userApi: {
    getUsers: vi.fn(),
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

describe('useTeamMembers', () => {
  const mockOnChanged = vi.fn()
  const mockMembers = [{ id: 'u1', display_name: 'User 1', role: 'leader' }]
  const mockUsers = [
    { id: 'u1', displayName: 'User 1', role: 'leader' },
    { id: 'u2', displayName: 'User 2', role: 'user' },
    { id: 'u3', displayName: 'Admin', role: 'admin' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads members for a team', async () => {
    vi.mocked(teamApi.getTeamMembers).mockResolvedValueOnce(mockMembers as any)
    const { result } = renderHook(() => useTeamMembers(mockOnChanged))

    await act(async () => {
      await result.current.loadMembers('t1')
    })

    expect(result.current.members).toEqual(mockMembers)
    expect(teamApi.getTeamMembers).toHaveBeenCalledWith('t1')
  })

  it('lazy loads users and filters available users', async () => {
    vi.mocked(userApi.getUsers).mockResolvedValueOnce(mockUsers as any)
    vi.mocked(teamApi.getTeamMembers).mockResolvedValueOnce(mockMembers as any)
    
    const { result } = renderHook(() => useTeamMembers(mockOnChanged))

    // First load members so we can filter them out from available users
    await act(async () => {
      await result.current.loadMembers('t1')
    })

    act(() => {
      result.current.ensureUsersLoaded()
    })

    await waitFor(() => expect(result.current.users).toHaveLength(3))

    // availableUsers: only 'user' or 'leader' roles, AND not already in team
    // u1 (leader) is in team. u2 (user) is not. u3 (admin) is not allowed.
    expect(result.current.availableUsers).toHaveLength(1)
    expect(result.current.availableUsers[0].id).toBe('u2')
  })

  it('adds members and refreshes', async () => {
    vi.mocked(teamApi.addMembers).mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useTeamMembers(mockOnChanged))

    act(() => {
      result.current.setSelectedUserIds(['u2'])
    })

    await act(async () => {
      await result.current.addMembers('t1')
    })

    expect(teamApi.addMembers).toHaveBeenCalledWith('t1', ['u2'])
    expect(globalMessage.success).toHaveBeenCalled()
    expect(mockOnChanged).toHaveBeenCalled()
    expect(result.current.selectedUserIds).toEqual([])
  })

  it('removes member after confirmation', async () => {
    mockConfirm.mockResolvedValueOnce(true)
    vi.mocked(teamApi.removeMember).mockResolvedValueOnce(undefined)
    
    const { result } = renderHook(() => useTeamMembers(mockOnChanged))

    await act(async () => {
      await result.current.removeMember('t1', 'u1')
    })

    expect(mockConfirm).toHaveBeenCalled()
    expect(teamApi.removeMember).toHaveBeenCalledWith('t1', 'u1')
    expect(mockOnChanged).toHaveBeenCalled()
  })

  it('resets state', () => {
    const { result } = renderHook(() => useTeamMembers(mockOnChanged))
    
    act(() => {
      result.current.setSelectedUserIds(['u1'])
    })
    
    act(() => {
      result.current.reset()
    })

    expect(result.current.selectedUserIds).toEqual([])
    expect(result.current.members).toEqual([])
  })
})
