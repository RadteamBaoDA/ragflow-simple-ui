/**
 * @fileoverview Unit tests for GlossaryService.
 * Mocks ModelFactory and log to verify business logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoist all mocks
const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

const mockGlossaryTaskModel = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  searchByName: vi.fn(),
  bulkInsertChunk: vi.fn(),
}))

const mockGlossaryKeywordModel = vi.hoisted(() => ({
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  searchByName: vi.fn(),
  bulkInsertChunk: vi.fn(),
}))

// Apply all mocks
vi.mock('../../src/shared/services/logger.service.js', () => ({
  log: mockLog,
}))

vi.mock('../../src/shared/models/factory.js', () => ({
  ModelFactory: {
    glossaryTask: mockGlossaryTaskModel,
    glossaryKeyword: mockGlossaryKeywordModel,
  },
}))

import { glossaryService } from '../../src/modules/glossary/glossary.service.js'

describe('GlossaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  // --------------------------------------------------------------------------
  // Task Operations
  // --------------------------------------------------------------------------

  describe('listTasks', () => {
    it('calls ModelFactory.glossaryTask.findAll without filter by default', async () => {
      mockGlossaryTaskModel.findAll.mockResolvedValueOnce([])
      const result = await glossaryService.listTasks()
      
      expect(mockGlossaryTaskModel.findAll).toHaveBeenCalledWith(undefined, {
        orderBy: { sort_order: 'asc', name: 'asc' },
      })
      expect(result).toEqual([])
    })

    it('calls ModelFactory.glossaryTask.findAll with is_active: true if activeOnly set', async () => {
      mockGlossaryTaskModel.findAll.mockResolvedValueOnce([{ id: 't1', is_active: true }])
      const result = await glossaryService.listTasks(true)
      
      expect(mockGlossaryTaskModel.findAll).toHaveBeenCalledWith({ is_active: true }, expect.any(Object))
      expect(result).toHaveLength(1)
    })
  });

  describe('getTask', () => {
    it('calls ModelFactory.glossaryTask.findById', async () => {
      mockGlossaryTaskModel.findById.mockResolvedValueOnce({ id: 't1' })
      const result = await glossaryService.getTask('t1')

      expect(mockGlossaryTaskModel.findById).toHaveBeenCalledWith('t1')
      expect(result).toEqual({ id: 't1' })
    })
  })

  describe('createTask', () => {
    it('calls ModelFactory.glossaryTask.create', async () => {
      const data = { name: 'New Task' }
      mockGlossaryTaskModel.create.mockResolvedValueOnce({ id: 't1', ...data })
      const result = await glossaryService.createTask(data)

      expect(mockGlossaryTaskModel.create).toHaveBeenCalledWith(data)
      expect(result.name).toBe('New Task')
    })
  })

  describe('updateTask', () => {
    it('calls ModelFactory.glossaryTask.update with new date', async () => {
      const data = { name: 'Updated' }
      mockGlossaryTaskModel.update.mockResolvedValueOnce({ id: 't1', ...data })
      const result = await glossaryService.updateTask('t1', data)

      expect(mockGlossaryTaskModel.update).toHaveBeenCalledWith('t1', expect.objectContaining({
        name: 'Updated',
        updated_at: expect.any(Date)
      }))
      expect(result?.name).toBe('Updated')
    })
  })

  describe('deleteTask', () => {
    it('calls ModelFactory.glossaryTask.delete', async () => {
      await glossaryService.deleteTask('t1')
      expect(mockGlossaryTaskModel.delete).toHaveBeenCalledWith('t1')
    })
  })

  // --------------------------------------------------------------------------
  // Keyword Operations
  // --------------------------------------------------------------------------

  describe('listKeywords', () => {
    it('calls ModelFactory.glossaryKeyword.findAll sorted', async () => {
      mockGlossaryKeywordModel.findAll.mockResolvedValueOnce([])
      const result = await glossaryService.listKeywords()

      expect(mockGlossaryKeywordModel.findAll).toHaveBeenCalledWith(undefined, {
        orderBy: { sort_order: 'asc', name: 'asc' },
      })
      expect(result).toEqual([])
    })
  })

  describe('createKeyword', () => {
    it('calls ModelFactory.glossaryKeyword.create', async () => {
      const data = { name: 'K1' }
      mockGlossaryKeywordModel.create.mockResolvedValueOnce({ id: 'k1', ...data })
      const result = await glossaryService.createKeyword(data)

      expect(mockGlossaryKeywordModel.create).toHaveBeenCalledWith(data)
      expect(result.name).toBe('K1')
    })
  })

  describe('updateKeyword', () => {
    it('calls ModelFactory.glossaryKeyword.update', async () => {
      const data = { name: 'K2' }
      mockGlossaryKeywordModel.update.mockResolvedValueOnce({ id: 'k2', ...data })
      const result = await glossaryService.updateKeyword('k2', data)

      expect(mockGlossaryKeywordModel.update).toHaveBeenCalledWith('k2', expect.objectContaining({
        name: 'K2',
        updated_at: expect.any(Date)
      }))
      expect(result?.name).toBe('K2')
    })
  })

  describe('deleteKeyword', () => {
    it('calls ModelFactory.glossaryKeyword.delete', async () => {
      await glossaryService.deleteKeyword('k1')
      expect(mockGlossaryKeywordModel.delete).toHaveBeenCalledWith('k1')
    })
  })

  // --------------------------------------------------------------------------
  // Prompt Builder
  // --------------------------------------------------------------------------

  describe('search', () => {
    it('calls searchByName on both models', async () => {
      mockGlossaryTaskModel.searchByName.mockResolvedValueOnce([])
      mockGlossaryKeywordModel.searchByName.mockResolvedValueOnce([])
      
      const result = await glossaryService.search('test')

      expect(mockGlossaryTaskModel.searchByName).toHaveBeenCalledWith('test')
      expect(mockGlossaryKeywordModel.searchByName).toHaveBeenCalledWith('test')
      expect(result).toEqual({ tasks: [], keywords: [] })
    })
  })

  describe('generatePrompt', () => {
    it('builds prompt using task instruction and context template', async () => {
      const task = { 
        id: 't1', 
        task_instruction_en: 'Action:', 
        context_template: 'Info for {keyword}.' 
      }
      const keywords = [
        { id: 'k1', name: 'KW1' },
        { id: 'k2', name: 'KW2' }
      ]

      mockGlossaryTaskModel.findById.mockResolvedValueOnce(task)
      mockGlossaryKeywordModel.findAll.mockResolvedValueOnce(keywords)

      const prompt = await glossaryService.generatePrompt('t1', ['k1', 'k2'])

      expect(prompt).toBe('Action:\nInfo for KW1, KW2.')
    })

    it('throws if task not found', async () => {
      mockGlossaryTaskModel.findById.mockResolvedValueOnce(null)
      await expect(glossaryService.generatePrompt('none', [])).rejects.toThrow('Task not found')
    })

    it('throws if no valid keywords selected', async () => {
      const task = { id: 't1', context_template: 'test' }
      mockGlossaryTaskModel.findById.mockResolvedValueOnce(task)
      mockGlossaryKeywordModel.findAll.mockResolvedValueOnce([])

      await expect(glossaryService.generatePrompt('t1', ['k1'])).rejects.toThrow('No valid keywords selected')
    })
  })

  // --------------------------------------------------------------------------
  // Bulk Import
  // --------------------------------------------------------------------------

  describe('bulkImport (Tasks)', () => {
    it('processes rows in chunks and returns aggregate results', async () => {
      const rows = Array(150).fill({ task_name: 'T' }) // Chunk size is 100
      mockGlossaryTaskModel.bulkInsertChunk
        .mockResolvedValueOnce({ created: 100, skipped: 0 })
        .mockResolvedValueOnce({ created: 50, skipped: 0 })

      const result = await glossaryService.bulkImport(rows, 'u1')

      expect(result.tasksCreated).toBe(150)
      expect(result.success).toBe(true)
      expect(mockGlossaryTaskModel.bulkInsertChunk).toHaveBeenCalledTimes(2)
      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('started'), expect.any(Object))
      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('completed'), expect.any(Object))
    })

    it('captures errors and sets success: false', async () => {
      const rows = [{ task_name: 'T' }]
      mockGlossaryTaskModel.bulkInsertChunk.mockRejectedValueOnce(new Error('Db Fail'))

      const result = await glossaryService.bulkImport(rows)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Db Fail')
      expect(mockLog.error).toHaveBeenCalled()
    })
  })

  describe('bulkImportKeywords', () => {
    it('processes rows in chunks', async () => {
      const rows = Array(50).fill({ name: 'K' })
      mockGlossaryKeywordModel.bulkInsertChunk.mockResolvedValueOnce({ created: 50, skipped: 0 })

      const result = await glossaryService.bulkImportKeywords(rows, 'u1')

      expect(result.created).toBe(50)
      expect(result.success).toBe(true)
      expect(mockGlossaryKeywordModel.bulkInsertChunk).toHaveBeenCalledTimes(1)
    })
  })
})
