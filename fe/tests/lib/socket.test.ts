import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { connectSocket, disconnectSocket, getSocket, getSocketStatus, isSocketConnected, subscribeToNotifications, subscribeToRoom } from '@/lib/socket'

let mockOn: any
let mockOff: any
let mockEmit: any
let mockDisconnect: any
let mockSocketInstance: any

const createMockSocket = () => {
  mockOn = vi.fn()
  mockOff = vi.fn()
  mockEmit = vi.fn()
  mockDisconnect = vi.fn()
  mockSocketInstance = {
    connected: false,
    id: 'socket-123',
    on: mockOn,
    off: mockOff,
    emit: mockEmit,
    disconnect: mockDisconnect
  }
  return mockSocketInstance
}

vi.mock('socket.io-client', () => {
  return {
    io: vi.fn((url: string, opts: any) => createMockSocket())
  }
})

vi.mock('@/config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3001'
  }
}))

describe('Socket.IO client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMockSocket()
    mockSocketInstance.connected = false
  })

  afterEach(() => {
    disconnectSocket()
    vi.clearAllMocks()
  })

  it('should connect socket with authentication options', () => {
    const auth = { email: 'test@example.com', userId: 'user-1' }
    const socket = connectSocket(auth)

    expect(socket).toBeDefined()
    expect(mockOn).toHaveBeenCalled()
  })

  it('should return existing socket if already connected', () => {
    mockSocketInstance.connected = true
    connectSocket({ email: 'test@example.com' })
    const socket = connectSocket({ email: 'test@example.com' })

    expect(socket).toBeDefined()
  })

  it('should setup connection event handlers', () => {
    connectSocket()

    const eventNames = mockOn.mock.calls.map(call => call[0])
    expect(eventNames).toContain('connect')
    expect(eventNames).toContain('disconnect')
    expect(eventNames).toContain('connect_error')
  })

  it('should setup reconnection event handlers', () => {
    connectSocket()

    const eventNames = mockOn.mock.calls.map(call => call[0])
    expect(eventNames).toContain('reconnect')
    expect(eventNames).toContain('reconnect_attempt')
  })

  it('should disconnect socket and clear instance', () => {
    mockSocketInstance.connected = true
    connectSocket()
    disconnectSocket()

    expect(mockDisconnect).toHaveBeenCalled()
  })

  it('should return null when socket not connected', () => {
    disconnectSocket()
    const socket = getSocket()

    expect(socket).toBeNull()
  })

  it('should return disconnected status by default', () => {
    disconnectSocket()
    const status = getSocketStatus()

    expect(status).toBe('disconnected')
  })

  it('should return connecting status during connection', () => {
    connectSocket()
    const status = getSocketStatus()

    expect(status).toBe('connecting')
  })

  it('should return false for isSocketConnected when disconnected', () => {
    disconnectSocket()
    const connected = isSocketConnected()

    expect(connected).toBe(false)
  })

  it('should return true for isSocketConnected when connected', () => {
    connectSocket()
    
    // Simulate socket.on connect event firing
    const connectHandler = mockOn.mock.calls.find(call => call[0] === 'connect')?.[1]
    if (connectHandler) {
      mockSocketInstance.connected = true
      connectHandler?.()
    }
    
    const connected = isSocketConnected()
    expect(connected).toBe(true)
  })

  it('should set status to connected when connect event fires', () => {
    connectSocket()

    const connectHandler = mockOn.mock.calls.find(call => call[0] === 'connect')?.[1]
    connectHandler?.()

    expect(getSocketStatus()).toBe('connected')
  })

  it('should set status to disconnected when disconnect event fires', () => {
    connectSocket()

    const disconnectHandler = mockOn.mock.calls.find(call => call[0] === 'disconnect')?.[1]
    disconnectHandler?.('client disconnect')

    expect(getSocketStatus()).toBe('disconnected')
  })

  it('should set status to error when connect_error event fires', () => {
    connectSocket()

    const errorHandler = mockOn.mock.calls.find(call => call[0] === 'connect_error')?.[1]
    errorHandler?.(new Error('Connection failed'))

    expect(getSocketStatus()).toBe('error')
  })
})

describe('Notification subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMockSocket()
    mockSocketInstance.connected = true
  })

  afterEach(() => {
    disconnectSocket()
    vi.clearAllMocks()
  })

  it('should subscribe to notification events', () => {
    connectSocket()
    const callback = vi.fn()

    subscribeToNotifications(callback)

    expect(mockOn).toHaveBeenCalledWith('notification', callback)
  })

  it('should return unsubscribe function', () => {
    connectSocket()
    const callback = vi.fn()

    const unsubscribe = subscribeToNotifications(callback)

    expect(typeof unsubscribe).toBe('function')
  })

  it('should unsubscribe from notifications', () => {
    connectSocket()
    const callback = vi.fn()

    const unsubscribe = subscribeToNotifications(callback)
    unsubscribe()

    expect(mockOff).toHaveBeenCalledWith('notification', callback)
  })

  it('should warn when subscribing without connected socket', () => {
    disconnectSocket()
    const callback = vi.fn()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation()

    subscribeToNotifications(callback)

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Not connected')
    )

    warnSpy.mockRestore()
  })

  it('should return empty function when not connected', () => {
    disconnectSocket()
    const callback = vi.fn()

    const unsubscribe = subscribeToNotifications(callback)
    unsubscribe()

    expect(mockOff).not.toHaveBeenCalled()
  })

  it('should emit subscribe event for room subscription', () => {
    connectSocket()

    subscribeToRoom('notifications')

    expect(mockEmit).toHaveBeenCalledWith('subscribe', 'notifications')
  })

  it('should warn when subscribing to room without connected socket', () => {
    disconnectSocket()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation()

    subscribeToRoom('test-room')

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Not connected')
    )

    warnSpy.mockRestore()
  })
})


