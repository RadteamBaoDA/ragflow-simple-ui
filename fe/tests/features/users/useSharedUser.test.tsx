import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSharedUser, SharedUserInfo } from '../../../src/features/users/hooks/useSharedUser'

describe('useSharedUser', () => {
  const mockUser: SharedUserInfo = { id: '1', email: 'user@test.com', name: 'Test User', role: 'admin' }
  const STORAGE_KEY = 'kb-user'

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('VITE_API_BASE_URL', '')
  })

  it('fetches user from backend if not in cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUser)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useSharedUser())
    
    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })

    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(mockUser))
  })

  it('uses cached user if available and refreshes in background', async () => {
    const cachedUser = { ...mockUser, name: 'Cached User' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedUser))
    
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUser)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useSharedUser())
    
    // Initially uses cache
    await waitFor(() => {
      expect(result.current.user).toEqual(cachedUser)
    }, { timeout: 3000 })

    // Background refresh should update state eventually
    await waitFor(() => {
      expect(result.current.user?.name).toBe('Test User')
    }, { timeout: 5000 })
    
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(mockUser))
  })

  it('handles fetch errors', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useSharedUser())
    
    await waitFor(() => {
      expect(result.current.error).toBe('Network error')
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 3000 })
  })

  it('handles 401 Unauthorized by clearing cache', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser))
    
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useSharedUser())
    
    await waitFor(() => {
      expect(result.current.user).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    }, { timeout: 3000 })
  })

  it('clears user data via clear function', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser))
    
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUser)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useSharedUser())
    
    await waitFor(() => expect(result.current.user).toBeTruthy(), { timeout: 3000 })
    
    result.current.clear()
    
    await waitFor(() => {
      expect(result.current.user).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    }, { timeout: 3000 })
  })
})