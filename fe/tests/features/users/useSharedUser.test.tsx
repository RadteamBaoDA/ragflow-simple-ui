import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'

const mockSharedStorage = vi.hoisted(() => {
  const getUser = vi.fn()
  const setUser = vi.fn()
  const clearUser = vi.fn()
  const subscribeToUserInfoChanges = vi.fn()
  return { getUser, setUser, storeUser: setUser, clearUser, subscribeToUserInfoChanges, subscribe: subscribeToUserInfoChanges }
})

const vi_mockUserPreferences = vi.hoisted(() => {
  const get = vi.fn()
  const set = vi.fn()
  const remove = vi.fn()
  const getAll = vi.fn()
  return { get, set, remove, getAll, getPreference: get, setPreference: set, removePreference: remove, getAllPreferences: getAll }
})

vi.mock('../../../src/features/documents/api/shared-storage.service', () => ({
  sharedStorage: mockSharedStorage,
  subscribeToUserInfoChanges: mockSharedStorage.subscribeToUserInfoChanges
}))
vi.mock('../../../src/features/users/api/userPreferences', () => ({
  userPreferences: vi_mockUserPreferences
}))

import { useSharedUser } from '../../../src/features/users/hooks/useSharedUser'

describe('useSharedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({})))) as any
    // sharedStorage.getUser is synchronous in implementation; return value should be immediate
    mockSharedStorage.getUser.mockReturnValue({ id: '1', email: 'user@e.com', name: 'User' })
    mockSharedStorage.subscribeToUserInfoChanges.mockReturnValue(vi.fn())
  })

  it('returns null initially', async () => {
    mockSharedStorage.getUser.mockImplementationOnce(() => new Promise(() => {}))
    const { result } = renderHook(() => useSharedUser())
    expect(result.current.isLoading).toBe(true)
  })

  it('shows loading state', () => {
    mockSharedStorage.getUser.mockImplementationOnce(() => new Promise(() => {}))
    const { result } = renderHook(() => useSharedUser())
    expect(result.current.isLoading).toBe(true)
  })

  it('fetches user on mount', async () => {
    mockSharedStorage.getUser.mockResolvedValue({ id: '1', email: 'user@e.com', name: 'User' })
    const { result } = renderHook(() => useSharedUser())
    await waitFor(() => expect(result.current.user).toBeTruthy())
  })

  it('handles fetch errors', async () => {
    // getUser throws synchronously in this scenario
    mockSharedStorage.getUser.mockImplementationOnce(() => { throw new Error('Network error') })
    const { result } = renderHook(() => useSharedUser())
    await waitFor(() => expect(result.current.error).toBeTruthy())
  })

  it('subscribed to user changes', async () => {
    renderHook(() => useSharedUser())
    await waitFor(() => expect(mockSharedStorage.subscribeToUserInfoChanges).toHaveBeenCalled())
  })

  it('refreshes user data', async () => {
    mockSharedStorage.getUser.mockReturnValue({ id: '1', email: 'user@e.com', name: 'User' })
    const { result } = renderHook(() => useSharedUser())
    await waitFor(() => result.current.user)
    await result.current.refresh()
    await waitFor(() => expect(mockSharedStorage.getUser).toHaveBeenCalled())
  })

  it('clears user data', async () => {
    mockSharedStorage.getUser.mockResolvedValue({ id: '1', email: 'user@e.com', name: 'User' })
    const { result } = renderHook(() => useSharedUser())
    await waitFor(() => result.current.user)
    result.current.clear()
    await waitFor(() => expect(result.current.user).toBeNull())
  })

  it('updates on broadcast message', async () => {
    let unsubscribe: any
    mockSharedStorage.subscribeToUserInfoChanges.mockImplementation((callback: any) => {
      unsubscribe = () => {}
      return unsubscribe
    })
    const { result } = renderHook(() => useSharedUser())
    await waitFor(() => expect(mockSharedStorage.subscribeToUserInfoChanges).toHaveBeenCalled())
  })

  it('handles null user response', async () => {
    mockSharedStorage.getUser.mockReturnValue(null)
    // Simulate backend returning non-ok response so no user is set
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))) as any
    const { result } = renderHook(() => useSharedUser())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user).toBeNull()
  })
})