/**
 * @fileoverview Socket.IO WebSocket service for real-time notification events.
 * 
 * This service provides WebSocket connectivity for both Python clients and web browsers.
 * Implements the Singleton pattern as per project guidelines.
 * 
 * @module services/socket
 * @example
 * import { socketService } from '@/shared/services/socket.service.js';
 * 
 * // Emit notification to all clients
 * socketService.emit('notification', { message: 'Hello' });
 * 
 * // Emit to specific user
 * socketService.emitToUser('user@example.com', 'notification', { message: 'Hello' });
 */

import { Server as SocketIOServer, Socket } from 'socket.io'
import * as http from 'http'
import * as https from 'https'
import { config } from '@/shared/config/index.js'
import { log } from '@/shared/services/logger.service.js'

/** Notification event payload interface */
export interface NotificationPayload {
    type: string
    title?: string
    message: string
    data?: Record<string, unknown>
    timestamp?: string
}

/** Socket authentication data */
export interface SocketAuthData {
    userId?: string
    email?: string
    token?: string
    /** API key for external client authentication */
    apiKey?: string
}

/** Client type based on authentication method */
export type SocketClientType = 'browser' | 'external'

/** Connected user socket mapping */
interface UserSocketMap {
    [userId: string]: Set<string>  // userId -> Set of socket IDs
}

/**
 * Socket.IO WebSocket service class.
 * Provides real-time communication for notification events.
 * 
 * @class SocketService
 */
export class SocketService {
    private io: SocketIOServer | null = null
    private userSockets: UserSocketMap = {}
    private initialized = false

    /**
     * Initialize Socket.IO server and attach to HTTP/HTTPS server.
     * 
     * @param server - HTTP or HTTPS server instance
     * @returns SocketIOServer - The Socket.IO server instance
     * @description Configures server with CORS, timeouts, and attaches event handlers.
     */
    initialize(server: http.Server | https.Server): SocketIOServer {
        if (this.initialized && this.io) {
            log.warn('Socket.IO already initialized')
            return this.io
        }

        // Determine CORS origin:
        // - If API key is configured, allow all origins for external clients
        // - Otherwise, restrict to configured cors origin or frontend URL
        const corsOrigin = config.websocket?.apiKey
            ? '*'
            : (config.websocket?.corsOrigin ?? config.frontendUrl)

        // Initialize server instance
        this.io = new SocketIOServer(server, {
            cors: {
                origin: corsOrigin,
                methods: ['GET', 'POST'],
                credentials: corsOrigin !== '*',  // Credentials only work with specific origins
            },
            pingTimeout: config.websocket?.pingTimeout ?? 60000,
            pingInterval: config.websocket?.pingInterval ?? 25000,
            transports: ['websocket', 'polling'],
        })

        // Setup handlers
        this.setupEventHandlers()
        this.initialized = true

        log.info('Socket.IO server initialized', {
            corsOrigin: config.websocket?.corsOrigin ?? config.frontendUrl,
        })

        return this.io
    }

    /**
     * Setup Socket.IO event handlers.
     * @returns void
     * @description Registers connection, auth, message, and error handlers.
     */
    private setupEventHandlers(): void {
        if (!this.io) return

        this.io.on('connection', (socket: Socket) => {
            log.info('Socket client connected', {
                socketId: socket.id,
                transport: socket.conn.transport.name,
            })

            // Handle authentication
            this.handleAuthentication(socket)

            // Handle subscription to channels/rooms
            socket.on('subscribe', (room: string) => {
                socket.join(room)
                log.debug('Socket joined room', { socketId: socket.id, room })
            })

            // Unsubscribe handler
            socket.on('unsubscribe', (room: string) => {
                socket.leave(room)
                log.debug('Socket left room', { socketId: socket.id, room })
            })

            // Handle ping for connection health check
            socket.on('ping', () => {
                socket.emit('pong', { timestamp: new Date().toISOString() })
            })

            // Handle disconnection
            socket.on('disconnect', (reason: string) => {
                this.handleDisconnect(socket, reason)
            })

            // Handle errors
            socket.on('error', (error: Error) => {
                log.error('Socket error', {
                    socketId: socket.id,
                    error: error.message,
                })
            })
        })
    }

    /**
     * Handle socket authentication.
     * Supports two authentication methods:
     * 1. API Key authentication for external clients (Python)
     * 2. Email/userId authentication for browser clients
     * 
     * @param socket - Socket instance
     * @returns void
     * @description Validates credentials and joins user-specific rooms.
     */
    private handleAuthentication(socket: Socket): void {
        const auth = socket.handshake.auth as SocketAuthData
        const apiKey = auth?.apiKey
        const userId = auth?.userId || auth?.email

        // Check API key authentication for external clients
        if (apiKey) {
            const configApiKey = config.websocket?.apiKey

            // If API key is configured, validate it
            if (configApiKey && configApiKey.length > 0) {
                if (apiKey !== configApiKey) {
                    log.warn('Socket connection rejected: invalid API key', {
                        socketId: socket.id,
                    })
                    socket.emit('auth:error', { message: 'Invalid API key' })
                    socket.disconnect(true)
                    return
                }
            }

            // Valid API key - track as external client
            socket.data.clientType = 'external' as SocketClientType
            socket.join('external-clients')

            log.info('Socket authenticated via API key', {
                socketId: socket.id,
                clientType: 'external',
            })
        }

        // Handle user identification (for both browser and external clients)
        if (userId) {
            // Track user's socket connection
            if (!this.userSockets[userId]) {
                this.userSockets[userId] = new Set()
            }
            this.userSockets[userId].add(socket.id)

            // Join user-specific room for targeted notifications
            socket.join(`user:${userId}`)

            // Set client type if not already set (browser client)
            if (!socket.data.clientType) {
                socket.data.clientType = 'browser' as SocketClientType
            }

            log.debug('Socket user identified', {
                socketId: socket.id,
                userId,
                clientType: socket.data.clientType,
            })
        }
    }

    /**
     * Handle socket disconnection.
     * 
     * @param socket - Socket instance.
     * @param reason - Disconnection reason.
     * @returns void
     * @description Cleans up user socket mapping on disconnect.
     */
    private handleDisconnect(socket: Socket, reason: string): void {
        const auth = socket.handshake.auth as SocketAuthData
        const userId = auth?.userId || auth?.email

        if (userId && this.userSockets[userId]) {
            this.userSockets[userId].delete(socket.id)
            if (this.userSockets[userId].size === 0) {
                delete this.userSockets[userId]
            }
        }

        log.info('Socket client disconnected', {
            socketId: socket.id,
            reason,
        })
    }

    /**
     * Emit event to all connected clients.
     * 
     * @param event - Event name.
     * @param data - Event payload.
     * @returns void
     */
    emit(event: string, data: unknown): void {
        if (!this.io) {
            log.warn('Socket.IO not initialized, cannot emit event', { event })
            return
        }
        this.io.emit(event, data)
        log.debug('Socket event emitted to all', { event })
    }

    /**
     * Emit event to a specific room/channel.
     * 
     * @param room - Room name.
     * @param event - Event name.
     * @param data - Event payload.
     * @returns void
     */
    emitToRoom(room: string, event: string, data: unknown): void {
        if (!this.io) {
            log.warn('Socket.IO not initialized, cannot emit to room', { room, event })
            return
        }
        this.io.to(room).emit(event, data)
        log.debug('Socket event emitted to room', { room, event })
    }

    /**
     * Emit event to a specific user by their ID/email.
     * 
     * @param userId - User ID or email.
     * @param event - Event name.
     * @param data - Event payload.
     * @returns void
     * @description Convenience wrapper for emitToRoom(`user:${userId}`).
     */
    emitToUser(userId: string, event: string, data: unknown): void {
        this.emitToRoom(`user:${userId}`, event, data)
    }

    /**
     * Send notification to all connected clients.
     * 
     * @param notification - Notification payload.
     * @returns void
     * @description Broadcasts a 'notification' event with timestamp.
     */
    sendNotification(notification: NotificationPayload): void {
        const payload = {
            ...notification,
            timestamp: notification.timestamp ?? new Date().toISOString(),
        }
        this.emit('notification', payload)
    }

    /**
     * Send notification to a specific user.
     * 
     * @param userId - User ID or email.
     * @param notification - Notification payload.
     * @returns void
     * @description Sends a 'notification' event to the user's room.
     */
    sendNotificationToUser(userId: string, notification: NotificationPayload): void {
        const payload = {
            ...notification,
            timestamp: notification.timestamp ?? new Date().toISOString(),
        }
        this.emitToUser(userId, 'notification', payload)
    }

    /**
     * Send notification to a specific room/channel.
     * 
     * @param room - Room name.
     * @param notification - Notification payload.
     * @returns void
     * @description Sends a 'notification' event to the room.
     */
    sendNotificationToRoom(room: string, notification: NotificationPayload): void {
        const payload = {
            ...notification,
            timestamp: notification.timestamp ?? new Date().toISOString(),
        }
        this.emitToRoom(room, 'notification', payload)
    }

    /**
     * Get the Socket.IO server instance.
     * 
     * @returns SocketIOServer | null - The server instance.
     */
    getIO(): SocketIOServer | null {
        return this.io
    }

    /**
     * Check if a user is currently connected.
     * 
     * @param userId - User ID or email.
     * @returns boolean - True if user has active connections.
     */
    isUserConnected(userId: string): boolean {
        return !!this.userSockets[userId] && this.userSockets[userId].size > 0
    }

    /**
     * Get count of connected clients.
     * 
     * @returns number - Number of connected clients.
     */
    getConnectedCount(): number {
        if (!this.io) return 0
        return this.io.engine.clientsCount
    }

    /**
     * Gracefully shutdown Socket.IO server.
     * @returns Promise<void>
     * @description Emits shutdown signal, closes connections, and cleans up references.
     */
    async shutdown(): Promise<void> {
        if (!this.io) return

        log.info('Shutting down Socket.IO server...')

        // Notify all clients about shutdown
        this.io.emit('server:shutdown', { message: 'Server is shutting down' })

        // Close all connections
        await new Promise<void>((resolve) => {
            this.io!.close(() => {
                log.info('Socket.IO server closed')
                resolve()
            })
        })

        this.io = null
        this.initialized = false
        this.userSockets = {}
    }
}

/** Singleton instance of SocketService */
export const socketService = new SocketService()
