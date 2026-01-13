/**
 * @fileoverview Unit tests for shared-storage service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getSharedDomain,
  storeUserInfo,
  getUserInfo,
  clearUserInfo,
  subscribeToUserInfoChanges,
} from '../../../../src/features/documents/api/shared-storage.service'

describe('shared-storage service', () => {
  beforeEach(() => {
    localStorage.clear()
    // Mock BroadcastChannel
    global.BroadcastChannel = vi.fn().mockImplementation(() => ({
      postMessage: vi.fn(),
      close: vi.fn(),
      onmessage: null,
    })) as any
    // Mock document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getSharedDomain', () => {
    it('returns shared domain', () => {
      const domain = getSharedDomain()
      expect(typeof domain).toBe('string')
    })
  })

  describe('storeUserInfo', () => {
    it('stores user info in localStorage', () => {
      const user = { id: '1', email: 'test@test.com', name: 'Test', displayName: 'Test User' }
      storeUserInfo(user)

      const stored = localStorage.getItem('kb_shared_user_info')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.id).toBe('1')
      expect(parsed.email).toBe('test@test.com')
      expect(parsed.lastUpdated).toBeTruthy()
      expect(parsed.source).toBe(window.location.hostname)
    })

    it('broadcasts to other tabs', () => {
      const user = { id: '1', email: 'test@test.com', name: 'Test', displayName: 'Test User' }
      const postMessageMock = vi.fn()
      global.BroadcastChannel = vi.fn().mockImplementation(() => ({
        postMessage: postMessageMock,
        close: vi.fn(),
      })) as any

      storeUserInfo(user)
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'USER_INFO_UPDATED', data: expect.objectContaining({ id: '1' }) })
      )
    })

    it('handles BroadcastChannel errors gracefully', () => {
      global.BroadcastChannel = vi.fn().mockImplementation(() => {
        throw new Error('Not supported')
      }) as any

      const user = { id: '1', email: 'test@test.com', name: 'Test', displayName: 'Test User' }
      expect(() => storeUserInfo(user)).not.toThrow()
    })
  })

  describe('getUserInfo', () => {
    it('retrieves user info from localStorage', () => {
      const user = {
        id: '1',
        email: 'test@test.com',
        name: 'Test',
        displayName: 'Test User',
        lastUpdated: new Date().toISOString(),
        source: 'localhost',
      }
      localStorage.setItem('kb_shared_user_info', JSON.stringify(user))

      const result = getUserInfo()
      expect(result).toEqual(user)
    })

    it('returns null when no user info stored', () => {
      const result = getUserInfo()
      expect(result).toBeNull()
    })

    it('handles invalid JSON gracefully', () => {
      localStorage.setItem('kb_shared_user_info', 'invalid json')
      const result = getUserInfo()
      expect(result).toBeNull()
    })
  })

  describe('clearUserInfo', () => {
    it('clears user info from localStorage', () => {
      localStorage.setItem('kb_shared_user_info', JSON.stringify({ id: '1' }))
      clearUserInfo()
      expect(localStorage.getItem('kb_shared_user_info')).toBeNull()
    })

    it('broadcasts clear message', () => {
      const postMessageMock = vi.fn()
      global.BroadcastChannel = vi.fn().mockImplementation(() => ({
        postMessage: postMessageMock,
        close: vi.fn(),
      })) as any

      clearUserInfo()
      expect(postMessageMock).toHaveBeenCalledWith({ type: 'USER_INFO_CLEARED' })
    })

    it('handles BroadcastChannel errors gracefully', () => {
      global.BroadcastChannel = vi.fn().mockImplementation(() => {
        throw new Error('Not supported')
      }) as any

      expect(() => clearUserInfo()).not.toThrow()
    })
  })

  describe('subscribeToUserInfoChanges', () => {
    it('subscribes to broadcast channel messages', () => {
      const callback = vi.fn()
      let messageHandler: any
      global.BroadcastChannel = vi.fn().mockImplementation(function (this: any) {
        this.onmessage = null
        this.close = vi.fn()
        // Capture onmessage setter
        Object.defineProperty(this, 'onmessage', {
          set: (handler: any) => {
            messageHandler = handler
          },
          get: () => messageHandler,
        })
        return this
      }) as any

      const unsubscribe = subscribeToUserInfoChanges(callback)

      // Simulate message
      if (messageHandler) {
        messageHandler({
          data: {
            type: 'USER_INFO_UPDATED',
            data: { id: '1', email: 'test@test.com' },
          },
        })
      }

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
      unsubscribe()
    })

    it('handles USER_INFO_CLEARED message', () => {
      const callback = vi.fn()
      let messageHandler: any
      global.BroadcastChannel = vi.fn().mockImplementation(function (this: any) {
        this.onmessage = null
        this.close = vi.fn()
        Object.defineProperty(this, 'onmessage', {
          set: (handler: any) => {
            messageHandler = handler
          },
          get: () => messageHandler,
        })
        return this
      }) as any

      subscribeToUserInfoChanges(callback)

      if (messageHandler) {
        messageHandler({ data: { type: 'USER_INFO_CLEARED' } })
      }

      expect(callback).toHaveBeenCalledWith(null)
    })

    it('falls back to storage event when BroadcastChannel not supported', () => {
      global.BroadcastChannel = vi.fn().mockImplementation(() => {
        throw new Error('Not supported')
      }) as any

      const callback = vi.fn()
      const addEventListener = vi.spyOn(window, 'addEventListener')

      const unsubscribe = subscribeToUserInfoChanges(callback)

      expect(addEventListener).toHaveBeenCalledWith('storage', expect.any(Function))
      unsubscribe()
    })
  })
})
