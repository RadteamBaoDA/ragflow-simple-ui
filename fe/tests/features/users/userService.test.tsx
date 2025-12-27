import { describe, it, expect, vi, beforeEach } from 'vitest'
import { userService } from '../../../src/features/users/api/userService'

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
  })

  it('fetches users', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([
        { id: '1', email: 'user@e.com', displayName: 'User', name: 'User' }
      ])))
    )
    const result = await userService.getUsers()
    expect(result).toHaveLength(1)
  })

  it('fetches users by role', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([
        { id: '1', email: 'admin@e.com', displayName: 'Admin', role: 'admin' }
      ])))
    )
    const result = await userService.getUsers(['admin'])
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('roles=admin'), expect.any(Object))
  })

  it('gets all users', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([
        { id: '1', email: 'user@e.com', displayName: 'User' }
      ])))
    )
    const result = await userService.getAllUsers()
    expect(result).toHaveLength(1)
  })

  it('updates user permissions', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null)))
    await userService.updateUserPermissions('1', ['read', 'write'])
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/users/1/permissions'), expect.objectContaining({ method: 'PUT' }))
  })

  it('includes authorization header', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify([]))))
    await userService.getUsers()
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }))
  })

  it('includes credentials', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify([]))))
    await userService.getUsers()
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ credentials: 'include' }))
  })

  it('maps display_name to displayName', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([
        { id: '1', email: 'user@e.com', display_name: 'John Doe' }
      ])))
    )
    const result = await userService.getUsers()
    expect(result[0].displayName).toBe('John Doe')
  })

  it('handles fetch errors', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 500 })))
    try {
      await userService.getUsers()
    } catch (e) {
      expect((e as Error).message).toContain('Failed')
    }
  })

  it('handles network errors', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))
    try {
      await userService.getUsers()
    } catch (e) {
      expect((e as Error).message).toContain('Network')
    }
  })
})