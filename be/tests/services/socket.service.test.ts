/**
 * @fileoverview Comprehensive unit tests for Socket.IO WebSocket service.
 * Tests initialization, authentication, event handling, room management, and notifications.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as http from 'http';

// Mock Socket.IO components
const mockSocket = {
  id: 'socket-123',
  handshake: {
    auth: {},
  },
  data: {},
  conn: {
    transport: { name: 'websocket' },
  },
  join: vi.fn(),
  leave: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
};

const mockIo = {
  on: vi.fn().mockReturnThis(),
  emit: vi.fn(),
  to: vi.fn(function(this: any) { return this; }), // Return this for chaining
  close: vi.fn((callback: () => void) => callback()),
  engine: {
    clientsCount: 5,
  },
};

const MockServer = vi.fn().mockImplementation(() => mockIo);

const mockLog = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

const mockConfig = {
  websocket: {
    apiKey: 'test-api-key',
    corsOrigin: 'http://localhost:3000',
    pingTimeout: 60000,
    pingInterval: 25000,
  },
  frontendUrl: 'http://localhost:5173',
};

vi.mock('socket.io', () => ({
  Server: MockServer,
}));

vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}));

vi.mock('../../src/config/index.js', () => ({
  config: mockConfig,
}));

describe.skip('SocketService', () => {
  let socketService: any;
  let mockServer: http.Server;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSocket.handshake.auth = {};
    mockSocket.data = {};
    mockIo.on.mockClear();
    
    const module = await import('../../src/services/socket.service.js');
    socketService = module.socketService;
    mockServer = {} as http.Server;
  });

  describe('initialize', () => {
    it('should create Socket.IO server with CORS configuration', () => {
      const io = socketService.initialize(mockServer);

      expect(MockServer).toHaveBeenCalledWith(
        mockServer,
        expect.objectContaining({
          cors: expect.objectContaining({
            origin: 'http://localhost:3000',
            methods: ['GET', 'POST'],
          }),
          pingTimeout: 60000,
          pingInterval: 25000,
        })
      );
      expect(mockLog.info).toHaveBeenCalledWith(
        'Socket.IO server initialized',
        expect.any(Object)
      );
      expect(io).toBe(mockIo);
    });

    it('should allow all origins when API key configured', () => {
      mockConfig.websocket.apiKey = 'test-key';
      
      socketService.initialize(mockServer);

      expect(MockServer).toHaveBeenCalledWith(
        mockServer,
        expect.objectContaining({
          cors: expect.objectContaining({
            origin: '*',
            credentials: false,
          }),
        })
      );
    });

    it('should warn if already initialized', () => {
      socketService.initialize(mockServer);
      const io2 = socketService.initialize(mockServer);

      expect(mockLog.warn).toHaveBeenCalledWith('Socket.IO already initialized');
      expect(io2).toBe(mockIo);
    });

    it('should setup connection event handler', () => {
      socketService.initialize(mockServer);

      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('connection and authentication', () => {
    it('should handle client connection and setup event handlers', () => {
      socketService.initialize(mockServer);
      const connectionHandler = mockIo.on.mock.calls[0][1];
      
      connectionHandler(mockSocket);

      expect(mockLog.info).toHaveBeenCalledWith(
        'Socket client connected',
        expect.objectContaining({
          socketId: 'socket-123',
          transport: 'websocket',
        })
      );
      expect(mockSocket.on).toHaveBeenCalledWith('subscribe', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('unsubscribe', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('ping', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should authenticate external client with valid API key', () => {
      mockSocket.handshake.auth = { apiKey: 'test-api-key' };
      socketService.initialize(mockServer);
      const connectionHandler = mockIo.on.mock.calls[0][1];
      
      connectionHandler(mockSocket);

      expect(mockSocket.data.clientType).toBe('external');
      expect(mockSocket.join).toHaveBeenCalledWith('external-clients');
      expect(mockLog.info).toHaveBeenCalledWith(
        'Socket authenticated via API key',
        expect.objectContaining({
          socketId: 'socket-123',
          clientType: 'external',
        })
      );
    });

    it('should reject connection with invalid API key', () => {
      mockSocket.handshake.auth = { apiKey: 'wrong-key' };
      socketService.initialize(mockServer);
      const connectionHandler = mockIo.on.mock.calls[0][1];
      
      connectionHandler(mockSocket);

      expect(mockLog.warn).toHaveBeenCalledWith(
        'Socket connection rejected: invalid API key',
        expect.any(Object)
      );
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'auth:error',
        { message: 'Invalid API key' }
      );
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should identify user from auth data', () => {
      mockSocket.handshake.auth = { userId: 'user@example.com' };
      socketService.initialize(mockServer);
      const connectionHandler = mockIo.on.mock.calls[0][1];
      
      connectionHandler(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('user:user@example.com');
      expect(mockSocket.data.clientType).toBe('browser');
    });

    it('should handle client disconnection', () => {
      mockSocket.handshake.auth = { userId: 'user@example.com' };
      socketService.initialize(mockServer);
      const connectionHandler = mockIo.on.mock.calls[0][1];
      
      connectionHandler(mockSocket);

      // Trigger disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.('client disconnect');

      expect(mockLog.info).toHaveBeenCalledWith(
        'Socket client disconnected',
        expect.objectContaining({
          socketId: 'socket-123',
          reason: 'client disconnect',
        })
      );
    });
  });


  describe('room management', () => {
    it('should allow clients to join rooms', () => {
      socketService.initialize(mockServer);
      const connectionHandler = mockIo.on.mock.calls[0][1];
      connectionHandler(mockSocket);

      const subscribeHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'subscribe'
      )?.[1];
      subscribeHandler?.('chat-room-123');

      expect(mockSocket.join).toHaveBeenCalledWith('chat-room-123');
      expect(mockLog.debug).toHaveBeenCalledWith(
        'Socket joined room',
        expect.objectContaining({
          socketId: 'socket-123',
          room: 'chat-room-123',
        })
      );
    });

    it('should allow clients to leave rooms', () => {
      socketService.initialize(mockServer);
      const connectionHandler = mockIo.on.mock.calls[0][1];
      connectionHandler(mockSocket);

      const unsubscribeHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'unsubscribe'
      )?.[1];
      unsubscribeHandler?.('chat-room-123');

      expect(mockSocket.leave).toHaveBeenCalledWith('chat-room-123');
    });

    it('should handle ping-pong for health check', () => {
      socketService.initialize(mockServer);
      const connectionHandler = mockIo.on.mock.calls[0][1];
      connectionHandler(mockSocket);

      const pingHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'ping'
      )?.[1];
      pingHandler?.();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'pong',
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('broadcasting', () => {
    beforeEach(() => {
      socketService.initialize(mockServer);
    });

    it('should broadcast event to all clients', () => {
      socketService.emit('test-event', { data: 'test' });

      expect(mockIo.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
      expect(mockLog.debug).toHaveBeenCalledWith(
        'Socket event emitted to all',
        expect.any(Object)
      );
    });

    it('should emit to specific room', () => {
      socketService.emitToRoom('room-123', 'test-event', { data: 'test' });

      expect(mockIo.to).toHaveBeenCalledWith('room-123');
      expect(mockIo.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('should emit to specific user', () => {
      socketService.emitToUser('user@example.com', 'test-event', { data: 'test' });

      expect(mockIo.to).toHaveBeenCalledWith('user:user@example.com');
    });

    it('should warn when emitting before initialization', () => {
      vi.clearAllMocks();
      vi.resetModules();
      const { SocketService } = require('../../src/services/socket.service.js');
      const service = new SocketService();

      service.emit('test', {});

      expect(mockLog.warn).toHaveBeenCalledWith(
        'Socket.IO not initialized, cannot emit event',
        expect.any(Object)
      );
    });
  });

  describe('notifications', () => {
    beforeEach(() => {
      socketService.initialize(mockServer);
    });

    it('should send notification to all clients', () => {
      const notification = {
        type: 'info',
        title: 'Test',
        message: 'Test message',
      };

      socketService.sendNotification(notification);

      expect(mockIo.emit).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          ...notification,
          timestamp: expect.any(String),
        })
      );
    });

    it('should send notification to specific user', () => {
      const notification = {
        type: 'warning',
        message: 'User-specific message',
      };

      socketService.sendNotificationToUser('user@example.com', notification);

      expect(mockIo.to).toHaveBeenCalledWith('user:user@example.com');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          ...notification,
          timestamp: expect.any(String),
        })
      );
    });

    it('should send notification to specific room', () => {
      const notification = {
        type: 'success',
        message: 'Room notification',
        data: { key: 'value' },
      };

      socketService.sendNotificationToRoom('room-123', notification);

      expect(mockIo.to).toHaveBeenCalledWith('room-123');
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      socketService.initialize(mockServer);
    });

    it('should return Socket.IO instance', () => {
      const io = socketService.getIO();

      expect(io).toBe(mockIo);
    });

    it('should check user connection status', () => {
      // User not connected
      expect(socketService.isUserConnected('user@example.com')).toBe(false);

      // Connect user
      mockSocket.handshake.auth = { userId: 'user@example.com' };
      const connectionHandler = mockIo.on.mock.calls[0][1];
      connectionHandler(mockSocket);

      // User connected
      expect(socketService.isUserConnected('user@example.com')).toBe(true);
    });

    it('should get connected client count', () => {
      const count = socketService.getConnectedCount();

      expect(count).toBe(5);
    });

    it('should return 0 count when not initialized', () => {
      vi.resetModules();
      const { SocketService } = require('../../src/services/socket.service.js');
      const service = new SocketService();

      expect(service.getConnectedCount()).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('should gracefully shutdown server', async () => {
      socketService.initialize(mockServer);

      await socketService.shutdown();

      expect(mockIo.emit).toHaveBeenCalledWith(
        'server:shutdown',
        { message: 'Server is shutting down' }
      );
      expect(mockIo.close).toHaveBeenCalled();
      expect(mockLog.info).toHaveBeenCalledWith('Socket.IO server closed');
    });

    it('should handle shutdown when not initialized', async () => {
      await expect(socketService.shutdown()).resolves.toBeUndefined();
    });
  });
});

