/**
 * @fileoverview Unit tests for Glossary API service.
 * Mocks the shared API client to verify endpoint paths and parameters.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { glossaryApi } from './glossaryApi'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

describe('glossaryApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('tasks', () => {
    it('listTasks calls GET /api/glossary/tasks', async () => {
      vi.mocked(api.get).mockResolvedValueOnce([])
      await glossaryApi.listTasks()
      expect(api.get).toHaveBeenCalledWith('/api/glossary/tasks')
    })

    it('createTask calls POST /api/glossary/tasks with data', async () => {
      const data = { name: 'Test', task_instruction_en: 'instr', context_template: 'ctx' }
      vi.mocked(api.post).mockResolvedValueOnce({ id: '1' })
      await glossaryApi.createTask(data)
      expect(api.post).toHaveBeenCalledWith('/api/glossary/tasks', data)
    })
  })

  describe('keywords', () => {
    it('listKeywords calls GET /api/glossary/keywords', async () => {
      vi.mocked(api.get).mockResolvedValueOnce([])
      await glossaryApi.listKeywords()
      expect(api.get).toHaveBeenCalledWith('/api/glossary/keywords')
    })

    it('deleteKeyword calls DELETE /api/glossary/keywords/:id', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce(undefined)
      await glossaryApi.deleteKeyword('k1')
      expect(api.delete).toHaveBeenCalledWith('/api/glossary/keywords/k1')
    })
  })

  describe('prompt builder', () => {
    it('search calls GET /api/glossary/search with encoded query', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ tasks: [], keywords: [] })
      await glossaryApi.search('test query')
      expect(api.get).toHaveBeenCalledWith('/api/glossary/search?q=test%20query')
    })

    it('generatePrompt calls POST /api/glossary/generate-prompt', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ prompt: 'generated' })
      await glossaryApi.generatePrompt('t1', ['k1', 'k2'])
      expect(api.post).toHaveBeenCalledWith('/api/glossary/generate-prompt', {
        taskId: 't1',
        keywordIds: ['k1', 'k2']
      })
    })
  })

  describe('bulk import', () => {
    it('bulkImport calls POST /api/glossary/bulk-import', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ success: true })
      await glossaryApi.bulkImport([])
      expect(api.post).toHaveBeenCalledWith('/api/glossary/bulk-import', { rows: [] })
    })
  })
})
