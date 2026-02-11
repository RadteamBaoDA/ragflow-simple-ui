/**
 * @fileoverview Unit tests for GlossaryService.
 * Mocks ModelFactory to isolate business logic from data access layer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Hoisted mocks
// ============================================================================

const mockGlossaryTask = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  searchByName: vi.fn(),
  bulkInsertChunk: vi.fn(),
}))

const mockGlossaryKeyword = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  searchByName: vi.fn(),
  bulkInsertChunk: vi.fn(),
}))

vi.mock('../../src/shared/models/factory.js', () => ({
  ModelFactory: {
    glossaryTask: mockGlossaryTask,
    glossaryKeyword: mockGlossaryKeyword,
  },
}))

vi.mock('../../src/shared/services/logger.service.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Import after mocks are registered
import { glossaryService } from '../../src/modules/glossary/glossary.service.js'

// ============================================================================
// Test fixtures
// ============================================================================

const TASK_FIXTURE = {
  id: 't1',
  name: 'Translate',
  task_instruction_en: 'Translate the following',
  context_template: 'Keyword: {keyword}',
  sort_order: 0,
  is_active: true,
}

const KEYWORD_FIXTURE = {
  id: 'k1',
  name: '契約書',
  en_keyword: 'contract',
  sort_order: 0,
  is_active: true,
}

// ============================================================================
// Tests
// ============================================================================

describe('GlossaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --------------------------------------------------------------------------
  // Task Operations
  // --------------------------------------------------------------------------

  describe('listTasks', () => {
    it('returns all tasks without filter', async () => {
      mockGlossaryTask.findAll.mockResolvedValueOnce([TASK_FIXTURE])

      const result = await glossaryService.listTasks()

      expect(mockGlossaryTask.findAll).toHaveBeenCalledWith(undefined, {
        orderBy: { sort_order: 'asc', name: 'asc' },
      })
      expect(result).toEqual([TASK_FIXTURE])
    })

    it('passes activeOnly filter when true', async () => {
      mockGlossaryTask.findAll.mockResolvedValueOnce([])

      await glossaryService.listTasks(true)

      expect(mockGlossaryTask.findAll).toHaveBeenCalledWith(
        { is_active: true },
        expect.any(Object),
      )
    })
  })

  describe('getTask', () => {
    it('returns task by ID', async () => {
      mockGlossaryTask.findById.mockResolvedValueOnce(TASK_FIXTURE)

      const result = await glossaryService.getTask('t1')

      expect(mockGlossaryTask.findById).toHaveBeenCalledWith('t1')
      expect(result).toEqual(TASK_FIXTURE)
    })

    it('returns undefined for missing task', async () => {
      mockGlossaryTask.findById.mockResolvedValueOnce(undefined)

      const result = await glossaryService.getTask('missing')

      expect(result).toBeUndefined()
    })
  })

  describe('createTask', () => {
    it('delegates to model and returns created task', async () => {
      mockGlossaryTask.create.mockResolvedValueOnce(TASK_FIXTURE)

      const result = await glossaryService.createTask({ name: 'Translate' })

      expect(mockGlossaryTask.create).toHaveBeenCalledWith({ name: 'Translate' })
      expect(result).toEqual(TASK_FIXTURE)
    })
  })

  describe('updateTask', () => {
    it('merges updated_at and delegates to model', async () => {
      mockGlossaryTask.update.mockResolvedValueOnce({ ...TASK_FIXTURE, name: 'Updated' })

      const result = await glossaryService.updateTask('t1', { name: 'Updated' })

      expect(mockGlossaryTask.update).toHaveBeenCalledWith('t1', expect.objectContaining({
        name: 'Updated',
        updated_at: expect.any(Date),
      }))
      expect(result?.name).toBe('Updated')
    })
  })

  describe('deleteTask', () => {
    it('delegates to model', async () => {
      mockGlossaryTask.delete.mockResolvedValueOnce(undefined)

      await glossaryService.deleteTask('t1')

      expect(mockGlossaryTask.delete).toHaveBeenCalledWith('t1')
    })
  })

  // --------------------------------------------------------------------------
  // Keyword Operations
  // --------------------------------------------------------------------------

  describe('listKeywords', () => {
    it('returns all keywords sorted', async () => {
      mockGlossaryKeyword.findAll.mockResolvedValueOnce([KEYWORD_FIXTURE])

      const result = await glossaryService.listKeywords()

      expect(mockGlossaryKeyword.findAll).toHaveBeenCalledWith(undefined, {
        orderBy: { sort_order: 'asc', name: 'asc' },
      })
      expect(result).toEqual([KEYWORD_FIXTURE])
    })
  })

  describe('createKeyword', () => {
    it('delegates to model', async () => {
      mockGlossaryKeyword.create.mockResolvedValueOnce(KEYWORD_FIXTURE)

      const result = await glossaryService.createKeyword({ name: '契約書' })

      expect(mockGlossaryKeyword.create).toHaveBeenCalledWith({ name: '契約書' })
      expect(result).toEqual(KEYWORD_FIXTURE)
    })
  })

  describe('updateKeyword', () => {
    it('merges updated_at and delegates to model', async () => {
      mockGlossaryKeyword.update.mockResolvedValueOnce(KEYWORD_FIXTURE)

      await glossaryService.updateKeyword('k1', { name: 'Updated' })

      expect(mockGlossaryKeyword.update).toHaveBeenCalledWith('k1', expect.objectContaining({
        name: 'Updated',
        updated_at: expect.any(Date),
      }))
    })
  })

  describe('deleteKeyword', () => {
    it('delegates to model', async () => {
      mockGlossaryKeyword.delete.mockResolvedValueOnce(undefined)

      await glossaryService.deleteKeyword('k1')

      expect(mockGlossaryKeyword.delete).toHaveBeenCalledWith('k1')
    })
  })

  // --------------------------------------------------------------------------
  // Prompt Builder
  // --------------------------------------------------------------------------

  describe('search', () => {
    it('runs searchByName in parallel for tasks and keywords', async () => {
      mockGlossaryTask.searchByName.mockResolvedValueOnce([TASK_FIXTURE])
      mockGlossaryKeyword.searchByName.mockResolvedValueOnce([KEYWORD_FIXTURE])

      const result = await glossaryService.search('test')

      expect(mockGlossaryTask.searchByName).toHaveBeenCalledWith('test')
      expect(mockGlossaryKeyword.searchByName).toHaveBeenCalledWith('test')
      expect(result).toEqual({ tasks: [TASK_FIXTURE], keywords: [KEYWORD_FIXTURE] })
    })
  })

  describe('generatePrompt', () => {
    it('builds prompt from task instruction and context template', async () => {
      mockGlossaryTask.findById.mockResolvedValueOnce(TASK_FIXTURE)
      mockGlossaryKeyword.findAll.mockResolvedValueOnce([KEYWORD_FIXTURE])

      const result = await glossaryService.generatePrompt('t1', ['k1'])

      expect(result).toBe('Translate the following\nKeyword: 契約書')
    })

    it('replaces multiple {keyword} placeholders', async () => {
      const task = { ...TASK_FIXTURE, context_template: '{keyword} and {keyword}' }
      mockGlossaryTask.findById.mockResolvedValueOnce(task)
      mockGlossaryKeyword.findAll.mockResolvedValueOnce([
        KEYWORD_FIXTURE,
        { ...KEYWORD_FIXTURE, id: 'k2', name: '仕様書' },
      ])

      const result = await glossaryService.generatePrompt('t1', ['k1', 'k2'])

      expect(result).toBe('Translate the following\n契約書, 仕様書 and 契約書, 仕様書')
    })

    it('throws when task not found', async () => {
      mockGlossaryTask.findById.mockResolvedValueOnce(undefined)

      await expect(glossaryService.generatePrompt('missing', ['k1'])).rejects.toThrow('Task not found')
    })

    it('throws when no valid keywords selected', async () => {
      mockGlossaryTask.findById.mockResolvedValueOnce(TASK_FIXTURE)
      mockGlossaryKeyword.findAll.mockResolvedValueOnce([KEYWORD_FIXTURE])

      await expect(glossaryService.generatePrompt('t1', ['nonexistent'])).rejects.toThrow('No valid keywords selected')
    })
  })

  // --------------------------------------------------------------------------
  // Bulk Import
  // --------------------------------------------------------------------------

  describe('bulkImport', () => {
    it('processes rows in chunks and accumulates counts', async () => {
      mockGlossaryTask.bulkInsertChunk.mockResolvedValueOnce({ created: 2, skipped: 1 })

      const rows = [
        { task_name: 'A', task_instruction_en: 'x', context_template: 'y' },
        { task_name: 'B', task_instruction_en: 'x', context_template: 'y' },
        { task_name: 'C', task_instruction_en: 'x', context_template: 'y' },
      ]

      const result = await glossaryService.bulkImport(rows, 'user1')

      expect(mockGlossaryTask.bulkInsertChunk).toHaveBeenCalledTimes(1)
      expect(result.tasksCreated).toBe(2)
      expect(result.skipped).toBe(1)
      expect(result.success).toBe(true)
    })

    it('handles chunk errors and marks success as false', async () => {
      mockGlossaryTask.bulkInsertChunk.mockRejectedValueOnce(new Error('DB error'))

      const rows = [{ task_name: 'A', task_instruction_en: 'x', context_template: 'y' }]

      const result = await glossaryService.bulkImport(rows, 'user1')

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('DB error')
    })
  })

  describe('bulkImportKeywords', () => {
    it('processes keyword rows and returns counts', async () => {
      mockGlossaryKeyword.bulkInsertChunk.mockResolvedValueOnce({ created: 3, skipped: 0 })

      const rows = [
        { name: 'A' },
        { name: 'B' },
        { name: 'C' },
      ]

      const result = await glossaryService.bulkImportKeywords(rows, 'user1')

      expect(mockGlossaryKeyword.bulkInsertChunk).toHaveBeenCalledTimes(1)
      expect(result.created).toBe(3)
      expect(result.skipped).toBe(0)
      expect(result.success).toBe(true)
    })

    it('handles chunk errors', async () => {
      mockGlossaryKeyword.bulkInsertChunk.mockRejectedValueOnce(new Error('fail'))

      const result = await glossaryService.bulkImportKeywords([{ name: 'X' }], 'user1')

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('fail')
    })
  })
})
