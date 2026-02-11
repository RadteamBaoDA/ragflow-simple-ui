/**
 * @fileoverview Simple unit tests for redis service focusing on business logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mocks
const mockRedisClient = {
  connect: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn().mockResolvedValue('OK'),
  on: vi.fn().mockReturnThis(),
  isReady: false,
  isOpen: false,
};

const mockCreateClient = vi.fn(() => mockRedisClient);

const mockLog = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

const mockConfig = {
  sessionStore: { type: 'redis' },
  redis: { url: 'redis://user:pass@localhost:6379' }
};

// Apply mocks
vi.mock('redis', () => ({
  createClient: mockCreateClient,
}));

vi.mock('../../../src/shared/services/logger.service.js', () => ({
  log: mockLog,
}));

vi.mock('../../../src/shared/config/index.js', () => ({
  config: mockConfig,
}));

describe('Redis Service - Simple Tests', () => {
  let redis: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCreateClient.mockReturnValue(mockRedisClient);
    mockRedisClient.isReady = false;
    mockRedisClient.isOpen = false;
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockConfig.sessionStore.type = 'redis';
    
    // Reset modules to clear singleton
    vi.resetModules();
    redis = await import('../../../src/shared/services/redis.service.js');
  });

  it('should initialize Redis client when configured', async () => {
    const client = await redis.initRedis();
    
    expect(mockCreateClient).toHaveBeenCalled();
    expect(mockRedisClient.connect).toHaveBeenCalled();
    expect(client).not.toBeNull();
  });

  it('should return null when not configured for Redis', async () => {
    mockConfig.sessionStore.type = 'memory';
    
    const client = await redis.initRedis();
    
    expect(client).toBeNull();
  });

  it('should return connection status', () => {
    const status = redis.getRedisStatus();
    expect(['connected', 'connecting', 'disconnected', 'not_initialized', 'not_configured']).toContain(status);
  });

  it('should return not_configured status when sessionStore is not redis', () => {
    mockConfig.sessionStore.type = 'memory';
    
    const status = redis.getRedisStatus();
    
    expect(status).toBe('not_configured');
  });

  it('should return not_initialized before client is created', () => {
    const status = redis.getRedisStatus();
    expect(status).toBe('not_initialized');
  });

  it('should return connected when client is ready', async () => {
    mockRedisClient.isReady = true;
    await redis.initRedis();
    
    const status = redis.getRedisStatus();
    
    expect(status).toBe('connected');
  });

  it('should return connecting when client is open but not ready', async () => {
    mockRedisClient.isOpen = true;
    mockRedisClient.isReady = false;
    await redis.initRedis();
    
    const status = redis.getRedisStatus();
    
    expect(status).toBe('connecting');
  });

  it('should return disconnected when client exists but not open', async () => {
    mockRedisClient.isOpen = false;
    mockRedisClient.isReady = false;
    await redis.initRedis();
    
    const status = redis.getRedisStatus();
    
    expect(status).toBe('disconnected');
  });

  it('should get redis client after initialization', async () => {
    await redis.initRedis();
    
    const client = redis.getRedisClient();
    
    expect(client).toBe(mockRedisClient);
  });

  it('should return null from getRedisClient before initialization', () => {
    const client = redis.getRedisClient();
    expect(client).toBeNull();
  });

  it('should shutdown redis client when open', async () => {
    mockRedisClient.isOpen = true;
    await redis.initRedis();
    
    await redis.shutdownRedis();
    
    expect(mockRedisClient.quit).toHaveBeenCalled();
  });

  it('should not quit when client is not open', async () => {
    mockRedisClient.isOpen = false;
    await redis.initRedis();
    
    await redis.shutdownRedis();
    
    expect(mockRedisClient.quit).not.toHaveBeenCalled();
  });

  it('should handle shutdown when client is null', async () => {
    await redis.shutdownRedis();
    expect(mockRedisClient.quit).not.toHaveBeenCalled();
  });

  it('should setup event handlers on initialization', async () => {
    await redis.initRedis();
    
    expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockRedisClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockRedisClient.on).toHaveBeenCalledWith('ready', expect.any(Function));
    expect(mockRedisClient.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
  });

  it('should return same client on multiple init calls (singleton)', async () => {
    const client1 = await redis.initRedis();
    const client2 = await redis.initRedis();
    
    expect(client1).toBe(client2);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it('should create client with correct config', async () => {
    await redis.initRedis();
    
    expect(mockCreateClient).toHaveBeenCalledWith({
      url: 'redis://user:pass@localhost:6379'
    });
  });
});
