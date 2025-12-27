import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'

const vi_mockNav = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi_mockNav, useLocation: () => ({ pathname: '/dash', search: '' }) }
})

import { AuthProvider, useAuth } from '../../../src/features/auth/hooks/useAuth'

const AuthTestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

describe('useAuth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const TestComponent = () => {
      useAuth()
      return null
    }
    expect(() => renderHook(() => useAuth())).toThrow()
    consoleError.mockRestore()
  })

  it('returns user when valid', async () => {
    const user = { id: '1', email: 't@e.com', name: 'Test', displayName: 'T', role: 'user' as const, permissions: [] }
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify(user))))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthTestWrapper })

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    expect(result.current.user).toEqual(user)
  })

  it('handles 401', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 401 })))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthTestWrapper })

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false))
  })

  it('handles network error', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('net')))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthTestWrapper })

    await waitFor(() => expect(result.current.error).toBe('net'))
  })

  it('checkSession works', async () => {
    const user = { id: '1', email: 't@e.com', name: 'Test', displayName: 'T', role: 'user' as const, permissions: [] }
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify(user))))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthTestWrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const valid = await result.current.checkSession()
    expect(valid).toBe(true)
  })

  it('logout works', async () => {
    const user = { id: '1', email: 't@e.com', name: 'Test', displayName: 'T', role: 'user' as const, permissions: [] }
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/auth/me')) return Promise.resolve(new Response(JSON.stringify(user)))
      if (url.includes('/api/auth/logout')) {
        // After logout, subsequent /me calls should return 401
        global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))) as any
        return Promise.resolve(new Response(null))
      }
      return Promise.resolve(new Response(null))
    }) as any

    const { result } = renderHook(() => useAuth(), { wrapper: AuthTestWrapper })

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    result.current.logout()
    await waitFor(() => expect(result.current.user).toBe(null), { timeout: 1000 })
  })
})
