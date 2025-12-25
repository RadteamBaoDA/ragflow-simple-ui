/**
 * @fileoverview Socket.IO client for real-time WebSocket communication.
 * 
 * Provides singleton socket connection and utilities for:
 * - Connecting to backend WebSocket server
 * - Subscribing to notification events
 * - Managing connection lifecycle
 * 
 * @module lib/socket
 * @example
 * import { socket, subscribeToNotifications, connectSocket } from '@/lib/socket';
 * 
 * // Connect with user authentication
 * connectSocket({ email: 'user@example.com' });
 * 
 * // Subscribe to notifications
 * const unsubscribe = subscribeToNotifications((notification) => {
 *   console.log('Received:', notification);
 * });
 * 
 * // Cleanup on unmount
 * unsubscribe();
 */

import { io, Socket } from 'socket.io-client'
import { config } from '@/config'

// ============================================================================
// Types
// ============================================================================

/** Notification payload from server */
export interface NotificationPayload {
    type: string
    title?: string
    message: string
    data?: Record<string, unknown>
    timestamp: string
}

/** Socket authentication options */
export interface SocketAuthOptions {
    userId?: string
    email?: string
    token?: string
}

/** Socket connection status */
export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// ============================================================================
// Socket Instance
// ============================================================================

/** Socket.IO client instance */
let socket: Socket | null = null
let connectionStatus: SocketStatus = 'disconnected'

/**
 * Get the WebSocket server URL from config.
 * Falls back to current origin if not configured.
 */
const getSocketUrl = (): string => {
    // Use API base URL or fallback to current origin
    const baseUrl = config.apiBaseUrl || window.location.origin
    return baseUrl
}

/**
 * Initialize and connect the socket with authentication.
 * 
 * @param auth - Authentication options (email, userId, token)
 * @returns Socket instance
 */
export const connectSocket = (auth?: SocketAuthOptions): Socket => {
    if (socket?.connected) {
        console.debug('[Socket] Already connected')
        return socket
    }

    const socketUrl = getSocketUrl()

    socket = io(socketUrl, {
        auth: auth || {},
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
    })

    // Connection event handlers
    socket.on('connect', () => {
        connectionStatus = 'connected'
        console.debug('[Socket] Connected:', socket?.id)
    })

    socket.on('disconnect', (reason) => {
        connectionStatus = 'disconnected'
        console.debug('[Socket] Disconnected:', reason)
    })

    socket.on('connect_error', (error) => {
        connectionStatus = 'error'
        console.error('[Socket] Connection error:', error.message)
    })

    socket.on('reconnect', (attempt) => {
        connectionStatus = 'connected'
        console.debug('[Socket] Reconnected after', attempt, 'attempts')
    })

    socket.on('reconnect_attempt', () => {
        connectionStatus = 'connecting'
        console.debug('[Socket] Attempting to reconnect...')
    })

    socket.on('pong', (data: { timestamp: string }) => {
        console.debug('[Socket] Pong received:', data.timestamp)
    })

    socket.on('server:shutdown', () => {
        console.warn('[Socket] Server is shutting down')
    })

    connectionStatus = 'connecting'
    return socket
}

/**
 * Disconnect the socket connection.
 */
export const disconnectSocket = (): void => {
    if (socket) {
        socket.disconnect()
        socket = null
        connectionStatus = 'disconnected'
        console.debug('[Socket] Manually disconnected')
    }
}

/**
 * Get the current socket instance.
 * 
 * @returns Socket instance or null if not connected
 */
export const getSocket = (): Socket | null => socket

/**
 * Get current connection status.
 * 
 * @returns Current socket connection status
 */
export const getSocketStatus = (): SocketStatus => connectionStatus

/**
 * Check if socket is currently connected.
 * 
 * @returns True if connected
 */
export const isSocketConnected = (): boolean => socket?.connected ?? false

// ============================================================================
// Notification Subscriptions
// ============================================================================

/**
 * Subscribe to notification events.
 * 
 * @param callback - Function to call when notification is received
 * @returns Unsubscribe function
 */
export const subscribeToNotifications = (
    callback: (notification: NotificationPayload) => void
): (() => void) => {
    if (!socket) {
        console.warn('[Socket] Not connected. Call connectSocket() first.')
        return () => { }
    }

    socket.on('notification', callback)

    return () => {
        socket?.off('notification', callback)
    }
}

/**
 * Subscribe to a specific room/channel.
 * 
 * @param room - Room name to join
 */
export const subscribeToRoom = (room: string): void => {
    if (!socket) {
        console.warn('[Socket] Not connected. Call connectSocket() first.')
        return
    }
    socket.emit('subscribe', room)
}

/**
 * Unsubscribe from a specific room/channel.
 * 
 * @param room - Room name to leave
 */
export const unsubscribeFromRoom = (room: string): void => {
    if (!socket) return
    socket.emit('unsubscribe', room)
}

/**
 * Send a ping to check connection health.
 */
export const sendPing = (): void => {
    if (!socket) return
    socket.emit('ping')
}

// ============================================================================
// Event Helpers
// ============================================================================

/**
 * Listen to any socket event.
 * 
 * @param event - Event name
 * @param callback - Event handler
 * @returns Unsubscribe function
 */
export const onSocketEvent = <T = unknown>(
    event: string,
    callback: (data: T) => void
): (() => void) => {
    if (!socket) {
        console.warn('[Socket] Not connected. Call connectSocket() first.')
        return () => { }
    }

    socket.on(event, callback)

    return () => {
        socket?.off(event, callback)
    }
}

/**
 * Emit an event to the server.
 * 
 * @param event - Event name
 * @param data - Event payload
 */
export const emitSocketEvent = <T = unknown>(event: string, data?: T): void => {
    if (!socket) {
        console.warn('[Socket] Not connected. Call connectSocket() first.')
        return
    }
    socket.emit(event, data)
}

// Export socket instance for direct access if needed
export { socket }
