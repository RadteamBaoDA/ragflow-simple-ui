/**
 * @fileoverview Unit tests for system tools service.
 * 
 * Tests system monitoring tools configuration loading.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import { constants } from 'fs';

// Mock the fs module before importing the service
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    readFile: vi.fn(),
    statfs: vi.fn(),
  },
  access: vi.fn(),
  readFile: vi.fn(),
  statfs: vi.fn(),
}));

// Mock logger to avoid console noise
vi.mock('../../src/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock config module
vi.mock('../../src/config/index.js', () => ({
  config: {
    systemToolsConfigPath: undefined,
    langfuse: {},
    database: {},
    redis: {},
  },
}));

describe('System Tools Service', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset modules to get fresh service instance
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should load config from fallback path if no env or docker path exists', async () => {
      // Mock access to fail for env/docker paths but succeed for fallback
      vi.mocked(fs.access).mockImplementation(async (path) => {
        // Reject the specific docker volume path
        if (path === '/app/config/system-tools.config.json') {
           return Promise.reject(new Error('ENOENT'));
        }
        // Accept other paths (including the fallback path which is likely in /app/be/src/...)
        if (typeof path === 'string' && path.includes('system-tools.config.json')) {
           return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validConfig));

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
      await systemToolsService.initialize();

      // Check if fs.readFile was called with the fallback path
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('system-tools.config.json'),
        'utf-8'
      );
    });
  });

  describe('getEnabledTools', () => {
    it('should return only enabled tools sorted by order', async () => {
      vi.mocked(fs.access).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validConfig));

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
      await systemToolsService.initialize();
      const tools = systemToolsService.getEnabledTools();

      expect(tools).toHaveLength(2);
      expect(tools[0]?.id).toBe('grafana');
      expect(tools[1]?.id).toBe('kibana');
      expect(tools.find(t => t.id === 'disabled-tool')).toBeUndefined();
    });

    it('should return empty array when config file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
      await systemToolsService.initialize();
      const tools = systemToolsService.getEnabledTools();

      expect(tools).toEqual([]);
    });

    it('should return empty array when config is invalid JSON', async () => {
      vi.mocked(fs.access).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue('{ invalid json }');

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
      await systemToolsService.initialize();
      const tools = systemToolsService.getEnabledTools();

      expect(tools).toEqual([]);
    });

    it('should return empty array when config has no tools array', async () => {
      vi.mocked(fs.access).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ notTools: [] }));

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
      await systemToolsService.initialize();
      const tools = systemToolsService.getEnabledTools();

      expect(tools).toEqual([]);
    });
  });

  describe('getAllTools', () => {
    it('should return all tools including disabled ones', async () => {
      vi.mocked(fs.access).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validConfig));

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
      await systemToolsService.initialize();
      const tools = systemToolsService.getAllTools();

      expect(tools).toHaveLength(3);
      expect(tools.find(t => t.id === 'disabled-tool')).toBeDefined();
    });

    it('should sort all tools by order', async () => {
      const unorderedConfig = {
        tools: [
          { id: 'c', order: 3, enabled: true, name: '', description: '', icon: '', url: '' },
          { id: 'a', order: 1, enabled: true, name: '', description: '', icon: '', url: '' },
          { id: 'b', order: 2, enabled: false, name: '', description: '', icon: '', url: '' },
        ],
      };
      vi.mocked(fs.access).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(unorderedConfig));

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
      await systemToolsService.initialize();
      const tools = systemToolsService.getAllTools();

      expect(tools[0]?.id).toBe('a');
      expect(tools[1]?.id).toBe('b');
      expect(tools[2]?.id).toBe('c');
    });
  });

  describe('reload', () => {
    it('should reload configuration from file', async () => {
      // Initial load with valid config
      vi.mocked(fs.access).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validConfig));

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
      await systemToolsService.initialize();
      expect(systemToolsService.getEnabledTools()).toHaveLength(2);

      // Update config with new tool
      const updatedConfig = {
        tools: [
          ...validConfig.tools,
          {
            id: 'new-tool',
            name: 'New Tool',
            description: 'Newly added',
            icon: 'plus',
            url: 'http://localhost:8080',
            order: 0,
            enabled: true,
          },
        ],
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(updatedConfig));

      await systemToolsService.reload();

      expect(systemToolsService.getEnabledTools()).toHaveLength(3);
      expect(systemToolsService.getEnabledTools()[0]?.id).toBe('new-tool'); // order: 0
    });
  });
});
