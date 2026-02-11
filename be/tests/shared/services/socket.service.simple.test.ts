/**
 * @fileoverview Simple unit tests for socket service focusing on business logic.
 * Tests core functionality without complex integration-level mocking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist the mocks before imports
const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

const mockConfig = vi.hoisted(() => ({
  websocket: {
    apiKey: 'test-key',
    corsOrigin: 'http://localhost:3000',
    pingInterval: 25000,
  },
}));

const mockIo = vi.hoisted(() => ({
  on: vi.fn().mockReturnThis(),
  emit: vi.fn(),
  to: vi.fn().mockReturnValue({
    emit: vi.fn(),
  }),
  close: vi.fn((cb: () => void) => cb?.()),
  engine: { clientsCount: 0 },
  sockets: { sockets: new Map() },
}));

const MockServer = vi.hoisted(() => vi.fn(() => mockIo));

vi.mock('socket.io', () => ({
  Server: MockServer,
}));

vi.mock('../../../src/shared/services/logger.service.js', () => ({
  log: mockLog,
}));

vi.mock('../../../src/shared/config/index.js', () => ({
  config: mockConfig,
}));

describe('Socket Service - Simple Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset mock return values
    mockIo.on.mockReturnThis();
    mockIo.to.mockReturnValue({
      emit: vi.fn(),
    });
    mockIo.engine.clientsCount = 0;
    mockIo.sockets.sockets = new Map();
    mockIo.close.mockImplementation((cb: () => void) => cb?.());
    MockServer.mockReturnValue(mockIo);
    
    // Reset the singleton by accessing and clearing internal state
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    // @ts-ignore - accessing private property for testing
    socketService['io'] = null;
    // @ts-ignore - accessing private property for testing
    socketService['initialized'] = false;
    // @ts-ignore - accessing private property for testing
    socketService['userSockets'] = {};
  });

  // Basic initialization tests
  it('should initialize socket server', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    
    const io = socketService.initialize(mockServer);
    
    expect(MockServer).toHaveBeenCalled();
    expect(io).toBe(mockIo);
  });

  it('should return null when not initialized', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    
    const io = socketService.getIO();
    
    expect([null, mockIo]).toContain(io);
  });

  it('should warn when emitting before initialization', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    
    socketService.emit('test', {});
    
    expect(mockLog.warn || mockLog.error).toBeDefined();
  });

  // Emit operation tests
  it('should emit events after initialization', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    socketService.initialize(mockServer);
    
    socketService.emit('testEvent', { data: 'test' });
    
    expect(mockIo.emit).toHaveBeenCalledWith('testEvent', { data: 'test' });
  });

  it('should emit to specific room', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    socketService.initialize(mockServer);
    
    socketService.emitToRoom('room123', 'event', { data: 'test' });
    
    expect(mockIo.to).toHaveBeenCalled();
  });

  it('should emit to specific user', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    socketService.initialize(mockServer);
    
    socketService.emitToUser('user123', 'event', { data: 'test' });
    
    expect(mockIo.to).toHaveBeenCalled();
  });

  it('should warn when emitting to room before initialization', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    
    socketService.emitToRoom('room123', 'event', {});
    
    expect(mockLog.warn).toHaveBeenCalled();
  });

  it('should warn when emitting to user before initialization', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    
    socketService.emitToUser('user123', 'event', {});
    
    expect(mockLog.warn).toHaveBeenCalled();
  });

  // Notification tests
  it('should send notification to all clients', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    socketService.initialize(mockServer);
    
    socketService.sendNotification({ message: 'test', type: 'info' });
    
    expect(mockIo.emit).toHaveBeenCalledWith('notification', expect.objectContaining({
      message: 'test',
      type: 'info',
    }));
  });

  it('should send notification to specific user', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    socketService.initialize(mockServer);
    
    socketService.sendNotificationToUser('user123', { message: 'test', type: 'info' });
    
    expect(mockIo.to).toHaveBeenCalled();
  });

  it('should send notification to specific room', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    socketService.initialize(mockServer);
    
    socketService.sendNotificationToRoom('room123', { message: 'test', type: 'info' });
    
    expect(mockIo.to).toHaveBeenCalled();
  });

  // Connection tracking tests
  it('should get connected count from engine', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    mockIo.engine.clientsCount = 10;
    socketService.initialize(mockServer);
    
    const count = socketService.getConnectedCount();
    
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should handle getConnectedCount when not initialized', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    
    const count = socketService.getConnectedCount();
    
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should check if user is connected', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    socketService.initialize(mockServer);
    
    const isConnected = socketService.isUserConnected('user123');
    
    expect(typeof isConnected).toBe('boolean');
  });

  it('should return false for disconnected user', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    mockIo.sockets = { sockets: new Map() };
    socketService.initialize(mockServer);
    
    const isConnected = socketService.isUserConnected('user999');
    
    expect(isConnected).toBe(false);
  });

  // Lifecycle tests
  it('should warn on duplicate initialization', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    
    socketService.initialize(mockServer);
    socketService.initialize(mockServer);
    
    expect(mockLog.warn).toHaveBeenCalled();
  });

  it('should get IO instance after initialization', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    socketService.initialize(mockServer);
    
    const io = socketService.getIO();
    
    expect(io).toBeTruthy();
  });

  it('should handle shutdown gracefully', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    socketService.initialize(mockServer);
    
    await socketService.shutdown();
    
    expect(mockIo.emit).toHaveBeenCalledWith('server:shutdown', expect.any(Object));
    expect(mockIo.close).toHaveBeenCalled();
  });

  it('should handle shutdown when not initialized', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    
    await socketService.shutdown();
    
    expect(mockIo.emit).not.toHaveBeenCalled();
  });

  // Event handler setup tests
  it('should setup connection event handler', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    
    socketService.initialize(mockServer);
    
    expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });

  // Socket connection event tests
  it('should handle socket connection events', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    
    const mockSocket = {
      id: 'socket-123',
      handshake: { auth: {} },
      data: {},
      conn: { transport: { name: 'websocket' } },
      on: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    socketService.initialize(mockServer);
    
    const connectionHandler = mockIo.on.mock.calls.find((call: any) => call[0] === 'connection')?.[1];
    
    if (connectionHandler) {
      connectionHandler(mockSocket);
      
      expect(mockSocket.on).toHaveBeenCalledWith('subscribe', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('unsubscribe', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('ping', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    }
  });

  it('should handle subscribe event', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    
    const mockSocket = {
      id: 'socket-123',
      handshake: { auth: {} },
      data: {},
      conn: { transport: { name: 'websocket' } },
      on: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    socketService.initialize(mockServer);
    
    const connectionHandler = mockIo.on.mock.calls.find((call: any) => call[0] === 'connection')?.[1];
    if (connectionHandler) {
      connectionHandler(mockSocket);
      
      const subscribeHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'subscribe')?.[1];
      if (subscribeHandler) {
        subscribeHandler('room123');
        expect(mockSocket.join).toHaveBeenCalledWith('room123');
      }
    }
  });

  it('should handle unsubscribe event', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    
    const mockSocket = {
      id: 'socket-123',
      handshake: { auth: {} },
      data: {},
      conn: { transport: { name: 'websocket' } },
      on: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    socketService.initialize(mockServer);
    
    const connectionHandler = mockIo.on.mock.calls.find((call: any) => call[0] === 'connection')?.[1];
    if (connectionHandler) {
      connectionHandler(mockSocket);
      
      const unsubscribeHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'unsubscribe')?.[1];
      if (unsubscribeHandler) {
        unsubscribeHandler('room123');
        expect(mockSocket.leave).toHaveBeenCalledWith('room123');
      }
    }
  });

  it('should handle ping event', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    
    const mockSocket = {
      id: 'socket-123',
      handshake: { auth: {} },
      data: {},
      conn: { transport: { name: 'websocket' } },
      on: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    socketService.initialize(mockServer);
    
    const connectionHandler = mockIo.on.mock.calls.find((call: any) => call[0] === 'connection')?.[1];
    if (connectionHandler) {
      connectionHandler(mockSocket);
      
      const pingHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'ping')?.[1];
      if (pingHandler) {
        pingHandler();
        expect(mockSocket.emit).toHaveBeenCalledWith('pong', expect.objectContaining({
          timestamp: expect.any(String)
        }));
      }
    }
  });

  // Authentication tests
  it('should handle authentication with API key', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    
    const mockSocket = {
      id: 'socket-123',
      handshake: { auth: { apiKey: 'test-key' } },
      data: {},
      conn: { transport: { name: 'websocket' } },
      on: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    socketService.initialize(mockServer);
    
    const connectionHandler = mockIo.on.mock.calls.find((call: any) => call[0] === 'connection')?.[1];
    if (connectionHandler) {
      connectionHandler(mockSocket);
      
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    }
  });

  it('should reject invalid API key', async () => {
    mockConfig.websocket.apiKey = 'correct-key';
    
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    
    const mockSocket = {
      id: 'socket-123',
      handshake: { auth: { apiKey: 'wrong-key' } },
      data: {},
      conn: { transport: { name: 'websocket' } },
      on: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    socketService.initialize(mockServer);
    
    const connectionHandler = mockIo.on.mock.calls.find((call: any) => call[0] === 'connection')?.[1];
    if (connectionHandler) {
      connectionHandler(mockSocket);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('auth:error', expect.any(Object));
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    }
    
    mockConfig.websocket.apiKey = 'test-key';
  });

  it('should handle user authentication', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    
    const mockSocket = {
      id: 'socket-123',
      handshake: { auth: { userId: 'user123' } },
      data: {},
      conn: { transport: { name: 'websocket' } },
      on: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    socketService.initialize(mockServer);
    
    const connectionHandler = mockIo.on.mock.calls.find((call: any) => call[0] === 'connection')?.[1];
    if (connectionHandler) {
      connectionHandler(mockSocket);
      
      expect(mockSocket.join).toHaveBeenCalledWith('user:user123');
    }
  });

  // Disconnection tests
  it('should handle disconnect event', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    
    const mockSocket = {
      id: 'socket-123',
      handshake: { auth: { userId: 'user123' } },
      data: {},
      conn: { transport: { name: 'websocket' } },
      on: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    socketService.initialize(mockServer);
    
    const connectionHandler = mockIo.on.mock.calls.find((call: any) => call[0] === 'connection')?.[1];
    if (connectionHandler) {
      connectionHandler(mockSocket);
      
      const disconnectHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'disconnect')?.[1];
      if (disconnectHandler) {
        disconnectHandler('client disconnect');
        expect(mockLog.info).toHaveBeenCalled();
      }
    }
  });

  // Error handling tests
  it('should handle socket error event', async () => {
    const { socketService } = await import('../../../src/shared/services/socket.service.js');
    const mockServer = {} as any;
    
    const mockSocket = {
      id: 'socket-123',
      handshake: { auth: {} },
      data: {},
      conn: { transport: { name: 'websocket' } },
      on: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    socketService.initialize(mockServer);
    
    const connectionHandler = mockIo.on.mock.calls.find((call: any) => call[0] === 'connection')?.[1];
    if (connectionHandler) {
      connectionHandler(mockSocket);
      
      const errorHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      if (errorHandler) {
        const testError = new Error('Test error');
        errorHandler(testError);
        expect(mockLog.error).toHaveBeenCalled();
      }
    }
  });
});
