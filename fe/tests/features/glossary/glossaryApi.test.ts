/**
 * @fileoverview Unit tests for glossaryApi service.
 * Mocks @/lib/api to verify correct endpoint calls and payloads.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { glossaryApi } from '../../../src/features/glossary/api/glossaryApi'
import { api } from '../../../src/lib/api'

vi.mock('../../../src/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('glossaryApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --------------------------------------------------------------------------
  // Task CRUD
  // --------------------------------------------------------------------------

  describe('listTasks', () => {
    it('calls GET /api/glossary/tasks', async () => {
      vi.mocked(api.get).mockResolvedValueOnce([])

      const result = await glossaryApi.listTasks()

      expect(api.get).toHaveBeenCalledWith('/api/glossary/tasks')
      expect(result).toEqual([])
    })
  })

  describe('getTask', () => {
    it('calls GET /api/glossary/tasks/:id', async () => {
      const task = { id: 't1', name: 'Test' }
      vi.mocked(api.get).mockResolvedValueOnce(task)

      const result = await glossaryApi.getTask('t1')

      expect(api.get).toHaveBeenCalledWith('/api/glossary/tasks/t1')
      expect(result).toEqual(task)
    })
  })

  describe('createTask', () => {
    it('calls POST /api/glossary/tasks with data', async () => {
      const dto = { name: 'New', task_instruction_en: 'x', context_template: 'y' }
      const created = { id: 't1', ...dto }
      vi.mocked(api.post).mockResolvedValueOnce(created)

      const result = await glossaryApi.createTask(dto)

      expect(api.post).toHaveBeenCalledWith('/api/glossary/tasks', dto)
      expect(result).toEqual(created)
    })
  })

  describe('updateTask', () => {
    it('calls PUT /api/glossary/tasks/:id with data', async () => {
      const data = { name: 'Updated' }
      vi.mocked(api.put).mockResolvedValueOnce({ id: 't1', ...data })

      const result = await glossaryApi.updateTask('t1', data)

      expect(api.put).toHaveBeenCalledWith('/api/glossary/tasks/t1', data)
      expect(result.name).toBe('Updated')
    })
  })

  describe('deleteTask', () => {
    it('calls DELETE /api/glossary/tasks/:id', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce(undefined)

      await glossaryApi.deleteTask('t1')

      expect(api.delete).toHaveBeenCalledWith('/api/glossary/tasks/t1')
    })
  })

  // --------------------------------------------------------------------------
  // Keyword CRUD
  // --------------------------------------------------------------------------

  describe('listKeywords', () => {
    it('calls GET /api/glossary/keywords', async () => {
      vi.mocked(api.get).mockResolvedValueOnce([])

      const result = await glossaryApi.listKeywords()

      expect(api.get).toHaveBeenCalledWith('/api/glossary/keywords')
      expect(result).toEqual([])
    })
  })

  describe('createKeyword', () => {
    it('calls POST /api/glossary/keywords with data', async () => {
      const dto = { name: 'Test keyword' }
      vi.mocked(api.post).mockResolvedValueOnce({ id: 'k1', ...dto })

      const result = await glossaryApi.createKeyword(dto)

      expect(api.post).toHaveBeenCalledWith('/api/glossary/keywords', dto)
      expect(result.name).toBe('Test keyword')
    })
  })

  describe('updateKeyword', () => {
    it('calls PUT /api/glossary/keywords/:id with data', async () => {
      const data = { name: 'Updated' }
      vi.mocked(api.put).mockResolvedValueOnce({ id: 'k1', ...data })

      await glossaryApi.updateKeyword('k1', data)

      expect(api.put).toHaveBeenCalledWith('/api/glossary/keywords/k1', data)
    })
  })

  describe('deleteKeyword', () => {
    it('calls DELETE /api/glossary/keywords/:id', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce(undefined)

      await glossaryApi.deleteKeyword('k1')

      expect(api.delete).toHaveBeenCalledWith('/api/glossary/keywords/k1')
    })
  })

  // --------------------------------------------------------------------------
  // Prompt Builder
  // --------------------------------------------------------------------------

  describe('search', () => {
    it('calls GET /api/glossary/search with encoded query', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ tasks: [], keywords: [] })

      const result = await glossaryApi.search('契約書')

      expect(api.get).toHaveBeenCalledWith(
        `/api/glossary/search?q=${encodeURIComponent('契約書')}`,
      )
      expect(result).toEqual({ tasks: [], keywords: [] })
    })
  })

  describe('generatePrompt', () => {
    it('calls POST /api/glossary/generate-prompt with taskId and keywordIds', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ prompt: 'generated' })

      const result = await glossaryApi.generatePrompt('t1', ['k1', 'k2'])

      expect(api.post).toHaveBeenCalledWith('/api/glossary/generate-prompt', {
        taskId: 't1',
        keywordIds: ['k1', 'k2'],
      })
      expect(result.prompt).toBe('generated')
    })
  })

  // --------------------------------------------------------------------------
  // Bulk Import
  // --------------------------------------------------------------------------

  describe('bulkImport', () => {
    it('calls POST /api/glossary/bulk-import with rows', async () => {
      const rows = [{ task_name: 'A', task_instruction_en: 'x', context_template: 'y' }]
      vi.mocked(api.post).mockResolvedValueOnce({ success: true, tasksCreated: 1, skipped: 0, errors: [] })

      const result = await glossaryApi.bulkImport(rows)

      expect(api.post).toHaveBeenCalledWith('/api/glossary/bulk-import', { rows })
      expect(result.success).toBe(true)
    })
  })

  describe('bulkImportKeywords', () => {
    it('calls POST /api/glossary/keywords/bulk-import with rows', async () => {
      const rows = [{ name: 'KW1' }]
      vi.mocked(api.post).mockResolvedValueOnce({ success: true, created: 1, skipped: 0, errors: [] })

      const result = await glossaryApi.bulkImportKeywords(rows)

      expect(api.post).toHaveBeenCalledWith('/api/glossary/keywords/bulk-import', { rows })
      expect(result.success).toBe(true)
    })
  })
})
