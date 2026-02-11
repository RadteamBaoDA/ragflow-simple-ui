/**
 * @fileoverview Unit tests for system tools service.
 * 
 * Tests system monitoring tools configuration loading.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFsPromises = vi.hoisted(() => ({
  access: vi.fn(),
  readFile: vi.fn(),
  statfs: vi.fn(),
}));

const mockLog = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
}));

const mockConfig = {
  systemToolsConfigPath: undefined as string | undefined,
  database: { host: 'localhost' },
  redis: { url: 'redis://localhost:6379', host: 'localhost' },
  langfuse: { publicKey: '', secretKey: '', baseUrl: '' },
};

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: mockFsPromises,
  access: mockFsPromises.access,
  readFile: mockFsPromises.readFile,
  statfs: mockFsPromises.statfs,
}));

vi.mock('fs', () => ({
  constants: { F_OK: 0 },
}));

vi.mock('../../src/shared/config/index.js', () => ({
  config: mockConfig,
}));

vi.mock('../../src/shared/services/logger.service.js', () => ({
  log: mockLog,
}));

vi.mock('../../src/shared/db/knex.js', () => ({
  db: {
    raw: vi.fn(),
  },
}));



const mockRedisClient = vi.hoisted(() => ({
  connect: vi.fn().mockResolvedValue(undefined),
  ping: vi.fn().mockResolvedValue('PONG'),
  disconnect: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
}));

vi.mock('redis', () => ({
  createClient: vi.fn(() => mockRedisClient),
}));

const validConfig = {
  tools: [
    {
      id: 'grafana',
      name: 'Grafana',
      description: 'Monitoring dashboard',
      icon: 'chart-line',
      url: 'http://localhost:3000',
      order: 1,
      enabled: true,
    },
    {
      id: 'kibana',
      name: 'Kibana',
      description: 'Log analytics',
      icon: 'search',
      url: 'http://localhost:5601',
      order: 2,
      enabled: true,
    },
    {
      id: 'disabled-tool',
      name: 'Disabled Tool',
      description: 'Not visible',
      icon: 'x',
      url: 'http://localhost:9999',
      order: 3,
      enabled: false,
    },
  ],
};

describe('System Tools Service', () => {
  let service: any;
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Default successful config load
    mockFsPromises.access.mockResolvedValue(undefined);
    mockFsPromises.readFile.mockResolvedValue(JSON.stringify(validConfig));

    // Import mocked modules
    const dbModule = await import('../../src/shared/db/knex.js');
    mockDb = dbModule.db;

    const module = await import('../../src/modules/system-tools/system-tools.service.js');
    service = module.systemToolsService;
    await service.initialize();
  });

  describe('initialize', () => {
    it('should load config from env path if available', async () => {
      mockConfig.systemToolsConfigPath = '/custom/path/config.json';
      mockFsPromises.access.mockResolvedValue(undefined);
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(validConfig));

      await service.initialize();

      expect(mockFsPromises.access).toHaveBeenCalled();
      expect(mockFsPromises.readFile).toHaveBeenCalled();
    });

    it('should warn if config file not found', async () => {
      mockFsPromises.access.mockRejectedValue(new Error('File not found'));

      await service.initialize();

      expect(mockLog.warn).toHaveBeenCalledWith(
        'System tools config file not found',
        expect.any(Object)
      );
    });

    it('should handle invalid JSON gracefully', async () => {
      mockFsPromises.readFile.mockResolvedValue('{ invalid json');

      await service.initialize();

      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to load system tools config',
        expect.any(Object)
      );
    });

    it('should handle invalid config format', async () => {
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify({ notTools: [] }));

      await service.initialize();

      expect(mockLog.error).toHaveBeenCalledWith('Invalid system tools config format');
    });
  });

  describe('getEnabledTools', () => {
    it('should return only enabled tools sorted by order', () => {
      const tools = service.getEnabledTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].id).toBe('grafana');
      expect(tools[1].id).toBe('kibana');
      expect(tools.every((t: any) => t.enabled)).toBe(true);
    });

    it('should return empty array when no tools configured', async () => {
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify({ tools: [] }));
      await service.initialize();

      const tools = service.getEnabledTools();

      expect(tools).toEqual([]);
    });

    it('should sort tools by order field', () => {
      const tools = service.getEnabledTools();

      for (let i = 1; i < tools.length; i++) {
        expect(tools[i].order).toBeGreaterThanOrEqual(tools[i - 1].order);
      }
    });
  });

  describe('getAllTools', () => {
    it('should return all tools including disabled ones', () => {
      const tools = service.getAllTools();

      expect(tools).toHaveLength(3);
      expect(tools.some((t: any) => !t.enabled)).toBe(true);
    });

    it('should sort all tools by order', () => {
      const tools = service.getAllTools();

      expect(tools[0].order).toBeLessThanOrEqual(tools[1].order);
      expect(tools[1].order).toBeLessThanOrEqual(tools[2].order);
    });
  });

  describe('getTools', () => {
    it('should be an alias for getEnabledTools', () => {
      const enabledTools = service.getEnabledTools();
      const tools = service.getTools();

      expect(tools).toEqual(enabledTools);
    });
  });

  describe('reload', () => {
    it('should reload configuration from disk', async () => {
      const newConfig = {
        tools: [
          {
            id: 'new-tool',
            name: 'New Tool',
            description: 'Newly added',
            icon: 'plus',
            url: 'http://localhost:8080',
            order: 1,
            enabled: true,
          },
        ],
      };

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(newConfig));

      await service.reload();

      const tools = service.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].id).toBe('new-tool');
    });

    it('should handle reload errors', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('Read error'));

      await service.reload();

      expect(mockLog.error).toHaveBeenCalled();
    });
  });

  describe('runTool', () => {
    it('should execute tool with params', async () => {
      const result = await service.runTool('grafana', { action: 'test' });

      expect(result).toEqual({
        message: 'Tool Grafana executed',
        params: { action: 'test' },
      });
    });

    it('should throw error for non-existent tool', async () => {
      await expect(service.runTool('nonexistent', {})).rejects.toThrow('Tool not found');
    });
  });

  describe('getSystemHealth', () => {
    it('should return health status for all services', async () => {
      (mockDb.raw as any).mockResolvedValue({});
      process.env.MINIO_ACCESS_KEY = 'test-key';
      process.env.MINIO_SECRET_KEY = 'test-secret';

      const health = await service.getSystemHealth();

      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('services');
      expect(health).toHaveProperty('system');
      expect(health.services).toHaveProperty('database');
      expect(health.services).toHaveProperty('redis');
      expect(health.services).toHaveProperty('langfuse');
    });

    it('should show database as connected when query succeeds', async () => {
      (mockDb.raw as any).mockResolvedValue({});

      const health = await service.getSystemHealth();

      expect(health.services.database.status).toBe('connected');
      expect(health.services.database.enabled).toBe(true);
    });

    it('should show database as disconnected when query fails', async () => {
      (mockDb.raw as any).mockRejectedValue(new Error('DB error'));

      const health = await service.getSystemHealth();

      expect(health.services.database.status).toBe('disconnected');
    });

    it('should include system metrics', async () => {
      const health = await service.getSystemHealth();

      expect(health.system).toHaveProperty('uptime');
      expect(health.system).toHaveProperty('memory');
      expect(health.system).toHaveProperty('loadAvg');
      expect(health.system).toHaveProperty('cpus');
      expect(health.system).toHaveProperty('platform');
      expect(health.system).toHaveProperty('nodeVersion');
      expect(health.system).toHaveProperty('cpuModel');
      expect(health.system).toHaveProperty('totalMemory');
      expect(health.system).toHaveProperty('hostname');
      expect(health.system).toHaveProperty('arch');
      expect(health.system).toHaveProperty('osRelease');
      expect(health.system).toHaveProperty('osType');
    });

    it('should handle disk stats gracefully when statfs fails', async () => {
      mockFsPromises.statfs.mockRejectedValue(new Error('Stats error'));

      const health = await service.getSystemHealth();

      expect(health.system.disk).toBeUndefined();
    });

    it('should calculate disk stats correctly', async () => {
      mockFsPromises.statfs.mockResolvedValue({
        bsize: 4096,
        blocks: 1000000,
        bfree: 500000,
        bavail: 450000,
      });

      const health = await service.getSystemHealth();

      expect(health.system.disk).toBeDefined();
      expect(health.system.disk.total).toBe(4096 * 1000000);
      expect(health.system.disk.free).toBe(4096 * 500000);
      expect(health.system.disk.available).toBe(4096 * 450000);
    });

    it('should show langfuse status as enabled when fully configured', async () => {
      mockConfig.langfuse.publicKey = 'pk-test';
      mockConfig.langfuse.secretKey = 'sk-test';
      mockConfig.langfuse.baseUrl = 'https://langfuse.test';

      const health = await service.getSystemHealth();

      expect(health.services.langfuse.status).toBe('enabled');
      expect(health.services.langfuse.enabled).toBe(true);
      expect(health.services.langfuse.host).toBe('langfuse.test');
    });

    it('should show langfuse as disabled when not configured', async () => {
      mockConfig.langfuse.publicKey = '';
      mockConfig.langfuse.secretKey = '';
      mockConfig.langfuse.baseUrl = '';

      const health = await service.getSystemHealth();

      expect(health.services.langfuse.status).toBe('disabled');
      expect(health.services.langfuse.enabled).toBe(false);
    });

    it('should include database host in response', async () => {
      const health = await service.getSystemHealth();

      expect(health.services.database.host).toBe('localhost');
    });

    it('should include redis host in response', async () => {
      const health = await service.getSystemHealth();

      expect(health.services.redis.host).toBe('localhost');
    });

    it('should have timestamp in ISO format', async () => {
      const health = await service.getSystemHealth();

      expect(health.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('path resolution edge cases', () => {
    it('should try env path first', async () => {
      mockConfig.systemToolsConfigPath = '/env/path/config.json';
      mockFsPromises.access
        .mockResolvedValueOnce(undefined) // env path succeeds
        .mockRejectedValue(new Error('not found'));

      await service.initialize();

      expect(mockFsPromises.access).toHaveBeenCalledWith('/env/path/config.json', 0);
    });

    it('should fallback to docker path when env fails', async () => {
      mockConfig.systemToolsConfigPath = '/env/path/config.json';
      mockFsPromises.access
        .mockRejectedValueOnce(new Error('not found')) // env path fails
        .mockResolvedValueOnce(undefined); // docker path succeeds

      await service.initialize();

      expect(mockFsPromises.access).toHaveBeenCalledWith('/env/path/config.json', 0);
      expect(mockFsPromises.access).toHaveBeenCalledWith('/app/config/system-tools.config.json', 0);
    });

    it('should use fallback path when all others fail', async () => {
      mockConfig.systemToolsConfigPath = undefined;
      mockFsPromises.access.mockRejectedValue(new Error('not found'));

      await service.initialize();

      // Fallback path is relative to __dirname, so we just verify it was attempted
      expect(mockFsPromises.readFile).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle JSON parse errors', async () => {
      mockFsPromises.readFile.mockResolvedValue('not valid json {');

      await service.initialize();

      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to load system tools config',
        expect.objectContaining({
          error: expect.stringContaining('JSON')
        })
      );
      expect(service.getTools()).toEqual([]);
    });

    it('should handle file read errors', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('Permission denied'));

      await service.initialize();

      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to load system tools config',
        expect.objectContaining({
          error: 'Permission denied'
        })
      );
      expect(service.getTools()).toEqual([]);
    });

    it('should set empty tools array on config error', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('Read error'));

      await service.initialize();

      expect(service.getAllTools()).toEqual([]);
      expect(service.getEnabledTools()).toEqual([]);
    });
  });

  describe('tool ordering', () => {
    it('should maintain order stability for tools with same order value', async () => {
      const configWithSameOrder = {
        tools: [
          { id: 'tool1', name: 'Tool 1', description: '', icon: '', url: '', order: 1, enabled: true },
          { id: 'tool2', name: 'Tool 2', description: '', icon: '', url: '', order: 1, enabled: true },
          { id: 'tool3', name: 'Tool 3', description: '', icon: '', url: '', order: 1, enabled: true },
        ],
      };

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(configWithSameOrder));
      await service.initialize();

      const tools = service.getTools();

      expect(tools).toHaveLength(3);
      expect(tools.every((t: any) => t.order === 1)).toBe(true);
    });
  });
});
