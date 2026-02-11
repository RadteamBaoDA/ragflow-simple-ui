/**
 * @fileoverview Unit tests for SystemToolsService.
 * Mocks fs, os, redis, and database connection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mocks
const { mockLog, mockFs, mockRedis, mockDb } = vi.hoisted(() => ({
  mockLog: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  mockFs: {
    access: vi.fn(),
    readFile: vi.fn(),
    statfs: vi.fn(),
  },
  mockRedis: {
    createClient: vi.fn(() => ({
      on: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue('PONG'),
      disconnect: vi.fn().mockResolvedValue(undefined),
    })),
  },
  mockDb: {
    raw: vi.fn(),
  }
}))

// Apply mocks
vi.mock('@/shared/services/logger.service.js', () => ({
  log: mockLog,
}))

vi.mock('fs/promises', () => mockFs)

vi.mock('os', () => ({
  loadavg: () => [1, 2, 3],
  cpus: () => [{ model: 'Test CPU' }],
  platform: () => 'test-platform',
  arch: () => 'x64',
  hostname: () => 'test-host',
  totalmem: () => 1024,
  release: () => '1.0',
  type: () => 'TestOS',
}))

vi.mock('redis', () => mockRedis)

vi.mock('@/shared/db/knex.js', () => ({
  db: mockDb,
}))

vi.mock('@/shared/config/index.js', () => ({
  config: {
    systemToolsConfigPath: '/env/path.json',
    redis: { url: 'redis://localhost', host: 'localhost' },
    database: { host: 'localhost' },
    langfuse: { publicKey: 'p', secretKey: 's', baseUrl: 'http://b.com' }
  },
}))

import { systemToolsService } from '../../src/modules/system-tools/system-tools.service.js'

describe('SystemToolsService', () => {
  let service: any;

  beforeEach(() => {
    vi.clearAllMocks()
    service = systemToolsService as any
    service.tools = []
    service.configPath = ''
  })

  describe('resolveConfigPath', () => {
    it('uses environment variable path if it exists', async () => {
      mockFs.access.mockResolvedValueOnce(undefined)
      const resolvedPath = await service.resolveConfigPath()
      expect(resolvedPath).toContain('path.json')
    })
  })

  describe('loadConfig', () => {
    it('successfully loads tools from JSON', async () => {
      const mockConfig = {
        tools: [{ id: 't1', name: 'Tool 1', order: 1, enabled: true }]
      }
      mockFs.access.mockResolvedValue(undefined)
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig))

      service.configPath = 'test.json'
      await service.loadConfig()

      expect(service.tools).toHaveLength(1)
    })
  })

  describe('getSystemHealth', () => {
    it('returns connected status for database and redis', async () => {
      mockDb.raw.mockResolvedValueOnce({ rows: [1] })
      mockFs.statfs.mockResolvedValueOnce({ bsize: 1, blocks: 1, bfree: 1, bavail: 1 })

      const health = await service.getSystemHealth()

      expect(health.services.database.status).toBe('connected')
      expect(health.services.redis.status).toBe('connected')
    })
  })
})
