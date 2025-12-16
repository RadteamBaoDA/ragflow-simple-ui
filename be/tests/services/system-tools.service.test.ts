/**
 * @fileoverview Unit tests for system tools service.
 * 
 * Tests system monitoring tools configuration loading.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock the fs module before importing the service
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock config module
vi.mock('../../src/config/index.js', () => ({
  config: {
    systemToolsConfigPath: undefined,
  },
}));

describe('System Tools Service', () => {
  const mockFsExistsSync = vi.mocked(fs.existsSync);
  const mockFsReadFileSync = vi.mocked(fs.readFileSync);

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

  describe('constructor', () => {
    it('should load config from fallback path if no env or docker path exists', async () => {
      mockFsExistsSync.mockImplementation((p: any) => {
        // Only return true for fallback config path (contains system-tools.config.json)
        return typeof p === 'string' && p.includes('system-tools.config.json') && !p.startsWith('/app');
      });
      mockFsReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');

      expect(mockFsReadFileSync).toHaveBeenCalled();
    });
  });

  describe('getEnabledTools', () => {
    it('should return only enabled tools sorted by order', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
      const tools = systemToolsService.getEnabledTools();

      expect(tools).toHaveLength(2);
      expect(tools[0]?.id).toBe('grafana');
      expect(tools[1]?.id).toBe('kibana');
      expect(tools.find(t => t.id === 'disabled-tool')).toBeUndefined();
    });

    it('should return empty array when config file does not exist', async () => {
      mockFsExistsSync.mockReturnValue(false);

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
      const tools = systemToolsService.getEnabledTools();

      expect(tools).toEqual([]);
    });

    it('should return empty array when config is invalid JSON', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue('{ invalid json }');

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
      const tools = systemToolsService.getEnabledTools();

      expect(tools).toEqual([]);
    });

    it('should return empty array when config has no tools array', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(JSON.stringify({ notTools: [] }));

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
      const tools = systemToolsService.getEnabledTools();

      expect(tools).toEqual([]);
    });
  });

  describe('getAllTools', () => {
    it('should return all tools including disabled ones', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
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
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(JSON.stringify(unorderedConfig));

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
      const tools = systemToolsService.getAllTools();

      expect(tools[0]?.id).toBe('a');
      expect(tools[1]?.id).toBe('b');
      expect(tools[2]?.id).toBe('c');
    });
  });

  describe('reload', () => {
    it('should reload configuration from file', async () => {
      // Initial load with valid config
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      const { systemToolsService } = await import('../../src/services/system-tools.service.js');
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
      mockFsReadFileSync.mockReturnValue(JSON.stringify(updatedConfig));

      systemToolsService.reload();

      expect(systemToolsService.getEnabledTools()).toHaveLength(3);
      expect(systemToolsService.getEnabledTools()[0]?.id).toBe('new-tool'); // order: 0
    });
  });
});
