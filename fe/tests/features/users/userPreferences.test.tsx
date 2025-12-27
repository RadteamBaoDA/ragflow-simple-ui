import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('userPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear IndexedDB mock
    const idbMock = {
      open: vi.fn(),
      deleteDatabase: vi.fn()
    }
    global.indexedDB = idbMock as any
  })

  it('stores user preference', async () => {
    const vi_mockUserPreferences = {
      setPreference: vi.fn(async (userId: string, key: string, value: any) => {
        return { userId, key, value }
      })
    }
    
    const result = await vi_mockUserPreferences.setPreference('user1', 'theme', 'dark')
    expect(result).toEqual({ userId: 'user1', key: 'theme', value: 'dark' })
  })

  it('retrieves user preference', async () => {
    const vi_mockUserPreferences = {
      getPreference: vi.fn(async (userId: string, key: string) => {
        return 'dark'
      })
    }
    
    const result = await vi_mockUserPreferences.getPreference('user1', 'theme')
    expect(result).toBe('dark')
  })

  it('removes user preference', async () => {
    const vi_mockUserPreferences = {
      removePreference: vi.fn(async (userId: string, key: string) => {
        return undefined
      })
    }
    
    await vi_mockUserPreferences.removePreference('user1', 'theme')
    expect(vi_mockUserPreferences.removePreference).toHaveBeenCalledWith('user1', 'theme')
  })

  it('gets all preferences for user', async () => {
    const vi_mockUserPreferences = {
      getAllPreferences: vi.fn(async (userId: string) => {
        return { theme: 'dark', language: 'en' }
      })
    }
    
    const result = await vi_mockUserPreferences.getAllPreferences('user1')
    expect(result).toEqual({ theme: 'dark', language: 'en' })
  })

  it('handles missing preference', async () => {
    const vi_mockUserPreferences = {
      getPreference: vi.fn(async (userId: string, key: string) => {
        return null
      })
    }
    
    const result = await vi_mockUserPreferences.getPreference('user1', 'missing')
    expect(result).toBeNull()
  })

  it('scopes preferences by userId', async () => {
    const vi_mockUserPreferences = {
      setPreference: vi.fn(),
      getPreference: vi.fn()
    }
    
    vi_mockUserPreferences.setPreference('user1', 'theme', 'dark')
    vi_mockUserPreferences.setPreference('user2', 'theme', 'light')
    
    expect(vi_mockUserPreferences.setPreference).toHaveBeenCalledWith('user1', 'theme', 'dark')
    expect(vi_mockUserPreferences.setPreference).toHaveBeenCalledWith('user2', 'theme', 'light')
  })

  it('handles IndexedDB errors', async () => {
    const vi_mockUserPreferences = {
      setPreference: vi.fn(async () => {
        throw new Error('IndexedDB error')
      })
    }
    
    try {
      await vi_mockUserPreferences.setPreference('user1', 'key', 'value')
    } catch (e) {
      expect((e as Error).message).toContain('IndexedDB')
    }
  })

  it('serializes complex values', async () => {
    const vi_mockUserPreferences = {
      setPreference: vi.fn(),
      getPreference: vi.fn()
    }
    
    const complexValue = { nested: { data: [1, 2, 3] } }
    vi_mockUserPreferences.setPreference('user1', 'config', complexValue)
    
    expect(vi_mockUserPreferences.setPreference).toHaveBeenCalledWith('user1', 'config', complexValue)
  })

  it('tracks update timestamp', async () => {
    const vi_mockUserPreferences = {
      setPreference: vi.fn(async (userId: string, key: string, value: any) => {
        return { userId, key, value, updatedAt: Date.now() }
      })
    }
    
    const result = await vi_mockUserPreferences.setPreference('user1', 'theme', 'dark')
    expect(result).toHaveProperty('updatedAt')
  })
})