/**
 * @fileoverview Tests for system tools service.
 *
 * Tests:
 * - Fetching system tools
 * - Reloading configuration
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSystemTools,
  reloadSystemTools,
  type SystemTool,
} from '@/features/system/api/systemToolsService';

// ============================================================================
// Mock Setup
// ============================================================================

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ============================================================================
// Helper Functions
// ============================================================================

function createMockResponse(data: unknown, ok = true, status = 200, statusText = 'OK') {
  return {
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(data),
  };
}

// ============================================================================
// Test Data
// ============================================================================

const mockSystemTools: SystemTool[] = [
  {
    id: 'grafana',
    name: 'Grafana',
    description: 'Monitoring and observability platform',
    icon: 'grafana.svg',
    url: 'https://grafana.example.com',
    order: 1,
    enabled: true,
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    description: 'Metrics collection and alerting',
    icon: 'prometheus.svg',
    url: 'https://prometheus.example.com',
    order: 2,
    enabled: true,
  },
  {
    id: 'kibana',
    name: 'Kibana',
    description: 'Log visualization and analytics',
    icon: 'kibana.svg',
    url: 'https://kibana.example.com',
    order: 3,
    enabled: true,
  },
];

// ============================================================================
// Tests
// ============================================================================

describe('systemToolsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSystemTools', () => {
    it('should fetch all enabled system tools', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ tools: mockSystemTools, count: 3 })
      );

      const result = await getSystemTools();

      expect(mockFetch).toHaveBeenCalledWith('/api/system-tools', {
        credentials: 'include',
      });
      expect(result).toEqual(mockSystemTools);
      expect(result).toHaveLength(3);
    });

    it('should return empty array when no tools', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ tools: [], count: 0 })
      );

      const result = await getSystemTools();

      expect(result).toEqual([]);
    });

    it('should throw error on failed fetch', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({}, false, 500, 'Internal Server Error')
      );

      await expect(getSystemTools()).rejects.toThrow(
        'Failed to fetch system tools: Internal Server Error'
      );
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(getSystemTools()).rejects.toThrow('Network error');
    });

    it('should include credentials for authentication', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ tools: mockSystemTools, count: 3 })
      );

      await getSystemTools();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ credentials: 'include' })
      );
    });
  });

  describe('reloadSystemTools', () => {
    it('should send POST request to reload configuration', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ message: 'Reloaded' }));

      await reloadSystemTools();

      expect(mockFetch).toHaveBeenCalledWith('/api/system-tools/reload', {
        method: 'POST',
        credentials: 'include',
      });
    });

    it('should throw error on failed reload', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({}, false, 403, 'Forbidden')
      );

      await expect(reloadSystemTools()).rejects.toThrow(
        'Failed to reload system tools: Forbidden'
      );
    });

    it('should throw error on 401 unauthorized', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({}, false, 401, 'Unauthorized')
      );

      await expect(reloadSystemTools()).rejects.toThrow(
        'Failed to reload system tools: Unauthorized'
      );
    });

    it('should complete without returning data', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}));

      const result = await reloadSystemTools();

      expect(result).toBeUndefined();
    });
  });

  describe('SystemTool type', () => {
    it('should have all required properties', () => {
      const tool: SystemTool = mockSystemTools[0];

      expect(tool).toHaveProperty('id');
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('icon');
      expect(tool).toHaveProperty('url');
      expect(tool).toHaveProperty('order');
      expect(tool).toHaveProperty('enabled');
    });

    it('should have correct property types', () => {
      const tool: SystemTool = mockSystemTools[0];

      expect(typeof tool.id).toBe('string');
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.icon).toBe('string');
      expect(typeof tool.url).toBe('string');
      expect(typeof tool.order).toBe('number');
      expect(typeof tool.enabled).toBe('boolean');
    });
  });
});
