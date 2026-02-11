/**
 * @fileoverview Unit tests for KnowledgeBaseService.
 * Mocks ModelFactory, auditService, teamService, and log.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoist mocks
const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

const mockAuditService = vi.hoisted(() => ({
  log: vi.fn(),
}))

const mockTeamService = vi.hoisted(() => ({
  getUserTeams: vi.fn(),
}))

const mockKBSourceModel = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getKnex: vi.fn(),
}))

const mockSystemConfigModel = vi.hoisted(() => ({
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}))

// Apply mocks
vi.mock('../../src/shared/services/logger.service.js', () => ({
  log: mockLog,
}))

vi.mock('../../src/modules/audit/audit.service.js', () => ({
  auditService: mockAuditService,
  AuditAction: {
    CREATE_SOURCE: 'CREATE_SOURCE',
    UPDATE_SOURCE: 'UPDATE_SOURCE',
    DELETE_SOURCE: 'DELETE_SOURCE',
    UPDATE_CONFIG: 'UPDATE_CONFIG',
  },
  AuditResourceType: {
    KNOWLEDGE_BASE_SOURCE: 'KNOWLEDGE_BASE_SOURCE',
    CONFIG: 'CONFIG',
  }
}))

vi.mock('../../src/modules/teams/team.service.js', () => ({
  teamService: mockTeamService,
}))

vi.mock('../../src/shared/models/factory.js', () => ({
  ModelFactory: {
    knowledgeBaseSource: mockKBSourceModel,
    systemConfig: mockSystemConfigModel,
  },
}))

vi.mock('../../src/shared/config/index.js', () => ({
  config: {
    kbBaseUrl: 'http://test-kb.com',
  },
}))

import { knowledgeBaseService } from '../../src/modules/knowledge-base/knowledge-base.service.js'

describe('KnowledgeBaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('getSources', () => {
    it('returns sources ordered by name', async () => {
      mockKBSourceModel.findAll.mockResolvedValueOnce([])
      const result = await knowledgeBaseService.getSources()
      
      expect(mockKBSourceModel.findAll).toHaveBeenCalledWith({}, { orderBy: { name: 'asc' } })
      expect(result).toEqual([])
    })
  })

  describe('getAvailableSources', () => {
    const mockSources = [
      { id: 's1', name: 'Public', access_control: { public: true } },
      { id: 's2', name: 'Private User', access_control: { public: false, user_ids: ['u1'] } },
      { id: 's3', name: 'Private Team', access_control: { public: false, team_ids: ['t1'] } },
    ]

    it('returns only public sources if no user provided', async () => {
      mockKBSourceModel.findAll.mockResolvedValueOnce(mockSources)
      const result = await knowledgeBaseService.getAvailableSources()
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('s1')
    })

    it('returns all sources for admin', async () => {
      mockKBSourceModel.findAll.mockResolvedValueOnce(mockSources)
      const result = await knowledgeBaseService.getAvailableSources({ id: 'admin', role: 'admin' })
      
      expect(result).toHaveLength(3)
    })

    it('filters sources for regular user by user_id and team_id', async () => {
      mockKBSourceModel.findAll.mockResolvedValueOnce(mockSources)
      mockTeamService.getUserTeams.mockResolvedValueOnce([{ id: 't1' }])

      const result = await knowledgeBaseService.getAvailableSources({ id: 'u1', role: 'user' })

      expect(result).toHaveLength(3) // Has public (s1), user access (s2), and team access (s3)
    })
  })

  describe('getSourcesPaginated', () => {
    it('calls findAll with pagination parameters', async () => {
      mockKBSourceModel.findAll.mockResolvedValueOnce([])
      const result = await knowledgeBaseService.getSourcesPaginated('chat', 2, 10)

      expect(mockKBSourceModel.findAll).toHaveBeenCalledWith(
        { type: 'chat' },
        { orderBy: { created_at: 'desc' }, limit: 10, offset: 10 }
      )
      expect(result.page).toBe(2)
      expect(result.total).toBe(100)
    })
  })

  describe('saveSystemConfig', () => {
    it('creates new config if not existing', async () => {
      mockSystemConfigModel.findById.mockResolvedValueOnce(null)
      await knowledgeBaseService.saveSystemConfig('key', 'val', { id: 'u1', email: 'u1@test.com' })

      expect(mockSystemConfigModel.create).toHaveBeenCalledWith({
        key: 'key',
        value: 'val',
        created_by: 'u1',
        updated_by: 'u1'
      })
      expect(mockAuditService.log).toHaveBeenCalled()
    })

    it('updates existing config', async () => {
      mockSystemConfigModel.findById.mockResolvedValueOnce({ key: 'key' })
      await knowledgeBaseService.saveSystemConfig('key', 'val')

      expect(mockSystemConfigModel.update).toHaveBeenCalledWith('key', {
        value: 'val',
        updated_by: null
      })
    })
  })

  describe('createSource', () => {
    it('creates source and logs audit', async () => {
      const mockKnex = {
        where: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(undefined)
      }
      mockKBSourceModel.getKnex.mockReturnValue(mockKnex)
      mockKBSourceModel.create.mockResolvedValueOnce({ id: 's1', name: 'New' })

      const result = await knowledgeBaseService.createSource(
        { type: 'chat', name: 'New', url: 'http://' },
        { id: 'u1', email: 'u1@test.com' }
      )

      expect(result.id).toBe('s1')
      expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATE_SOURCE'
      }))
    })

    it('throws if name already exists for type', async () => {
      const mockKnex = {
        where: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 'existing' })
      }
      mockKBSourceModel.getKnex.mockReturnValue(mockKnex)

      await expect(knowledgeBaseService.createSource({ name: 'Dup', type: 'chat' }))
        .rejects.toThrow('already exists')
    })
  })

  describe('updateSource', () => {
    it('updates source fields and logs audit', async () => {
      const mockKnex = {
        where: vi.fn().mockReturnThis(),
        whereNot: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(undefined)
      }
      mockKBSourceModel.getKnex.mockReturnValue(mockKnex)
      mockKBSourceModel.findById.mockResolvedValueOnce({ id: 's1', name: 'Old', type: 'chat' })
      mockKBSourceModel.update.mockResolvedValueOnce({ id: 's1', name: 'New' })

      const result = await knowledgeBaseService.updateSource('s1', { name: 'New' }, { id: 'u1', email: 'u1@test.com' })

      expect(result?.name).toBe('New')
      expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE_SOURCE'
      }))
    })
  })

  describe('deleteSource', () => {
    it('deletes source and logs audit', async () => {
      mockKBSourceModel.findById.mockResolvedValueOnce({ id: 's1', name: 'Gone' })
      await knowledgeBaseService.deleteSource('s1', { id: 'u1', email: 'u1@test.com' })

      expect(mockKBSourceModel.delete).toHaveBeenCalledWith('s1')
      expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'DELETE_SOURCE'
      }))
    })
  })

  describe('getConfig', () => {
    it('returns combined configuration', async () => {
      mockKBSourceModel.findAll.mockResolvedValueOnce([
        { id: 'c1', type: 'chat', access_control: { public: true } },
        { id: 's1', type: 'search', access_control: { public: true } }
      ])
      mockSystemConfigModel.findById.mockImplementation((key) => {
          if (key === 'defaultChatSourceId') return { value: 'c1' }
          if (key === 'defaultSearchSourceId') return { value: 's1' }
          return null
      })

      const result = await knowledgeBaseService.getConfig()

      expect(result.chatSources).toHaveLength(1)
      expect(result.searchSources).toHaveLength(1)
      expect(result.defaultChatSourceId).toBe('c1')
      expect(result.kbBaseUrl).toBe('http://test-kb.com')
    })
  })
})
