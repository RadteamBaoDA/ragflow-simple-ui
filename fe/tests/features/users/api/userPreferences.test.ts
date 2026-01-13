/**
 * @fileoverview Unit tests for userPreferences service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { userPreferences } from '../../../../src/features/users/api/userPreferences'

describe('userPreferences', () => {
  let mockDB: any
  let mockTransaction: any
  let mockStore: any
  let openRequest: any

  beforeEach(() => {
    // Mock IndexedDB
    mockStore = {
      get: vi.fn(),
      put: vi.fn(),
    }

    mockTransaction = {
      objectStore: vi.fn(() => mockStore),
    }

    mockDB = {
      objectStoreNames: {
        contains: vi.fn(() => false),
      },
      createObjectStore: vi.fn(),
      transaction: vi.fn(() => mockTransaction),
    }

    openRequest = {
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
      result: mockDB,
    }

    global.indexedDB = {
      open: vi.fn(() => openRequest),
    } as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('get', () => {
    it('retrieves stored value', async () => {
      const getRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: { userId: 'user1', key: 'theme', value: 'dark', updatedAt: Date.now() },
      }
      mockStore.get.mockReturnValue(getRequest)

      // Trigger DB open success
      setTimeout(() => {
        if (openRequest.onsuccess) openRequest.onsuccess({ target: openRequest })
      }, 0)

      const promise = userPreferences.get('user1', 'theme', 'light')

      // Wait for DB open
      await new Promise((r) => setTimeout(r, 10))

      // Trigger get success
      if (getRequest.onsuccess) {
        getRequest.onsuccess()
      }

      const result = await promise
      expect(result).toBe('dark')
    })

    it('returns default value when not found', async () => {
      const getRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: undefined,
      }
      mockStore.get.mockReturnValue(getRequest)

      setTimeout(() => {
        if (openRequest.onsuccess) openRequest.onsuccess({ target: openRequest })
      }, 0)

      const promise = userPreferences.get('user1', 'theme', 'light')

      await new Promise((r) => setTimeout(r, 10))

      if (getRequest.onsuccess) {
        getRequest.onsuccess()
      }

      const result = await promise
      expect(result).toBe('light')
    })

    it('handles get errors gracefully', async () => {
      const getRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: undefined,
      }
      mockStore.get.mockReturnValue(getRequest)

      setTimeout(() => {
        if (openRequest.onsuccess) openRequest.onsuccess({ target: openRequest })
      }, 0)

      const promise = userPreferences.get('user1', 'theme', 'light')

      await new Promise((r) => setTimeout(r, 10))

      if (getRequest.onerror) {
        getRequest.onerror()
      }

      const result = await promise
      expect(result).toBe('light')
    })
  })

  describe('set', () => {
    it('saves value successfully', async () => {
      const putRequest = {
        onsuccess: null as any,
        onerror: null as any,
      }
      mockStore.put.mockReturnValue(putRequest)

      setTimeout(() => {
        if (openRequest.onsuccess) openRequest.onsuccess({ target: openRequest })
      }, 0)

      const promise = userPreferences.set('user1', 'theme', 'dark')

      await new Promise((r) => setTimeout(r, 10))

      if (putRequest.onsuccess) {
        putRequest.onsuccess()
      }

      await promise
      expect(mockStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          key: 'theme',
          value: 'dark',
          updatedAt: expect.any(Number),
        })
      )
    })

    it('handles save errors gracefully', async () => {
      const putRequest = {
        onsuccess: null as any,
        onerror: null as any,
      }
      mockStore.put.mockReturnValue(putRequest)

      setTimeout(() => {
        if (openRequest.onsuccess) openRequest.onsuccess({ target: openRequest })
      }, 0)

      const promise = userPreferences.set('user1', 'theme', 'dark')

      await new Promise((r) => setTimeout(r, 10))

      if (putRequest.onerror) {
        putRequest.onerror({ target: putRequest })
      }

      await expect(promise).resolves.toBeUndefined()
    })
  })

  describe('database upgrade', () => {
    it('creates object store on first access', async () => {
      // Reset dbPromise for fresh test
      (userPreferences as any).dbPromise = null
      
      mockDB.objectStoreNames.contains.mockReturnValue(false)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      setTimeout(() => {
        if (openRequest.onupgradeneeded) {
          openRequest.onupgradeneeded({ target: openRequest })
        }
        if (openRequest.onsuccess) {
          openRequest.onsuccess({ target: openRequest })
        }
      }, 0)

      const getRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: undefined,
      }
      mockStore.get.mockReturnValue(getRequest)

      const promise = userPreferences.get('user1', 'key', 'default')

      await new Promise((r) => setTimeout(r, 10))

      if (getRequest.onsuccess) {
        getRequest.onsuccess()
      }

      await promise

      expect(mockDB.createObjectStore).toHaveBeenCalledWith('user_settings', { keyPath: ['userId', 'key'] })
      
      consoleSpy.mockRestore()
    })

    it('does not recreate existing object store', async () => {
      mockDB.objectStoreNames.contains.mockReturnValue(true)

      setTimeout(() => {
        if (openRequest.onupgradeneeded) {
          openRequest.onupgradeneeded({ target: openRequest })
        }
        if (openRequest.onsuccess) {
          openRequest.onsuccess({ target: openRequest })
        }
      }, 0)

      const getRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: undefined,
      }
      mockStore.get.mockReturnValue(getRequest)

      const promise = userPreferences.get('user1', 'key', 'default')

      await new Promise((r) => setTimeout(r, 10))

      if (getRequest.onsuccess) {
        getRequest.onsuccess()
      }

      await promise

      expect(mockDB.createObjectStore).not.toHaveBeenCalled()
    })
  })
})
