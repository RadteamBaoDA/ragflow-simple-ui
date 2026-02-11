/**
 * @fileoverview Unit tests for redis service.
 * 
 * Tests Redis client initialization, connection management, and status reporting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis client
const mockRedisClient: any = {
  connect: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn().mockResolvedValue('OK'),
  get: vi.fn(),
  set: vi.fn(),
  setEx: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  on: vi.fn(function(this: any) { return this; }),
  isReady: false,
  isOpen: false,
};

const mockCreateClient = vi.fn();

// Hoist mocks
const mockLog = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

const mockConfig = {
  sessionStore: { type: 'redis' },
  redis: { url: 'redis://user:password@localhost:6379' }
};

// Apply mocks
vi.mock('redis', () => ({
  createClient: mockCreateClient,
}));

vi.mock('../../src/shared/services/logger.service.js', () => ({
  log: mockLog,
}));

vi.mock('../../src/shared/config/index.js', () => ({
  config: mockConfig,
}));

describe.skip('RedisService', () => {
  let redisService: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Set mock implementation AFTER clearing
    mockCreateClient.mockImplementation(() => mockRedisClient);
    
    // Reset client state
    mockRedisClient.isReady = false;
    mockRedisClient.isOpen = false;
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockRedisClient.quit.mockResolvedValue('OK');
    mockConfig.sessionStore.type = 'redis';
    
    // Import service (mocks are already applied via vi.mock above)
    redisService = await import('../../src/shared/services/redis.service.js');
    
    // Reset singleton by calling shutdown
    await redisService.shutdownRedis();
  });

  describe('initRedis', () => {
    it('should return null when sessionStore type is not redis', async () => {
      mockConfig.sessionStore.type = 'memory';
      
      
      const client = await redisService.initRedis();

      expect(mockLog.info).toHaveBeenCalledWith('Redis not configured (using memory store)');
      expect(mockCreateClient).not.toHaveBeenCalled();
      expect(client).toBeNull();
    });
  });

  describe('getRedisStatus', () => {
    it('should return not_configured when sessionStore is not redis', async () => {
      mockConfig.sessionStore.type = 'memory';
      
      
      const status = redisService.getRedisStatus();

      expect(status).toBe('not_configured');
    });

    it('should return not_initialized when client is null', async () => {
      mockConfig.sessionStore.type = 'redis';
      
      
      const status = redisService.getRedisStatus();

      expect(status).toBe('not_initialized');
    });
  });

  describe('getRedisClient', () => {
    it('should return null when not initialized', async () => {
      
      const client = redisService.getRedisClient();

      expect(client).toBeNull();
    });
  });

  describe('shutdownRedis', () => {
    it('should not error when client is null', async () => {
      
      
      await expect(shutdownRedis()).resolves.not.toThrow();
      expect(mockRedisClient.quit).not.toHaveBeenCalled();
    });

    it('should gracefully quit when client is open', async () => {
      mockRedisClient.isOpen = true;
      
      
      await redisService.initRedis();
      await redisService.shutdownRedis();

      expect(mockRedisClient.quit).toHaveBeenCalled();
      expect(mockLog.info).toHaveBeenCalledWith('Redis client disconnected');
    });

    it('should not quit when client is not open', async () => {
      mockRedisClient.isOpen = false;
      
      
      await redisService.initRedis();
      await redisService.shutdownRedis();

      expect(mockRedisClient.quit).not.toHaveBeenCalled();
    });
  });

  describe('getRedisStatus - extended', () => {
    it('should return connected when client is ready', async () => {
      mockRedisClient.isReady = true;
      
      
      await redisService.initRedis();
      const status = redisService.getRedisStatus();

      expect(status).toBe('connected');
    });

    it('should return connecting when client is open but not ready', async () => {
      mockRedisClient.isOpen = true;
      mockRedisClient.isReady = false;
      
      
      await redisService.initRedis();
      const status = redisService.getRedisStatus();

      expect(status).toBe('connecting');
    });

    it('should return disconnected when client exists but not open', async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.isReady = false;
      
      
      await redisService.initRedis();
      const status = redisService.getRedisStatus();

      expect(status).toBe('disconnected');
    });
  });

  describe('getRedisClient - extended', () => {
    it('should return client after initialization', async () => {
      
      await redisService.initRedis();
      const client = redisService.getRedisClient();

      expect(client).toBe(mockRedisClient);
    });
  });

  describe('Redis event handlers', () => {
    it('should setup error event handler', async () => {
      
      await redisService.initRedis();

      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should setup connect event handler', async () => {
      
      await redisService.initRedis();

      expect(mockRedisClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('should setup ready event handler', async () => {
      
      await redisService.initRedis();

      expect(mockRedisClient.on).toHaveBeenCalledWith('ready', expect.any(Function));
    });

    it('should setup reconnecting event handler', async () => {
      
      await redisService.initRedis();

      expect(mockRedisClient.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
    });

    it('should log error when error event fires', async () => {
      
      await redisService.initRedis();

      const errorHandler = mockRedisClient.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      errorHandler?.(new Error('Connection failed'));

      expect(mockLog.error).toHaveBeenCalledWith(
        'Redis client error',
        expect.objectContaining({ error: 'Connection failed' })
      );
    });

    it('should log debug when connect event fires', async () => {
      
      await redisService.initRedis();

      const connectHandler = mockRedisClient.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();

      expect(mockLog.debug).toHaveBeenCalledWith('Redis client connected');
    });

    it('should log info when ready event fires', async () => {
      
      await redisService.initRedis();

      const readyHandler = mockRedisClient.on.mock.calls.find(
        call => call[0] === 'ready'
      )?.[1];
      readyHandler?.();

      expect(mockLog.info).toHaveBeenCalledWith('Redis client ready');
    });

    it('should log warn when reconnecting event fires', async () => {
      
      await redisService.initRedis();

      const reconnectingHandler = mockRedisClient.on.mock.calls.find(
        call => call[0] === 'reconnecting'
      )?.[1];
      reconnectingHandler?.();

      expect(mockLog.warn).toHaveBeenCalledWith('Redis client reconnecting');
    });
  });

  describe('Redis initialization', () => {
    it('should create client with correct URL', async () => {
      
      await redisService.initRedis();

      expect(mockCreateClient).toHaveBeenCalledWith({
        url: 'redis://user:password@localhost:6379',
      });
    });

    it('should mask password in log', async () => {
      
      await redisService.initRedis();

      expect(mockLog.info).toHaveBeenCalledWith(
        'Initializing Redis client...',
        expect.objectContaining({
          url: expect.stringContaining('***'),
        })
      );
    });

    it('should call connect on client', async () => {
      
      await redisService.initRedis();

      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should return same client on multiple calls', async () => {
      
      const client1 = await redisService.initRedis();
      const client2 = await redisService.initRedis();

      expect(client1).toBe(client2);
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });

    it('should handle connection errors gracefully', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection refused'));
      
      
      const client = await redisService.initRedis();

      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to connect to Redis',
        expect.objectContaining({ error: 'Connection refused' })
      );
      expect(client).toBe(mockRedisClient);
    });

    it('should handle non-Error connection failures', async () => {
      mockRedisClient.connect.mockRejectedValue('String error');
      
      
      await redisService.initRedis();

      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to connect to Redis',
        expect.objectContaining({ error: 'String error' })
      );
    });
  });
});
