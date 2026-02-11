/**
 * @fileoverview Unit tests for GlossaryController.
 * Mocks glossaryService to test HTTP request/response handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GlossaryController } from '../../src/modules/glossary/glossary.controller.js'

// ============================================================================
// Hoisted mocks
// ============================================================================

const mockService = vi.hoisted(() => ({
  listTasks: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  listKeywords: vi.fn(),
  createKeyword: vi.fn(),
  updateKeyword: vi.fn(),
  deleteKeyword: vi.fn(),
  search: vi.fn(),
  generatePrompt: vi.fn(),
  bulkImport: vi.fn(),
  bulkImportKeywords: vi.fn(),
}))

vi.mock('../../src/modules/glossary/glossary.service.js', () => ({
  glossaryService: mockService,
}))

// ============================================================================
// Helpers
// ============================================================================

/** Create a chainable mock Express response. */
const makeRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.send = vi.fn(() => res)
  return res
}

/** Create a minimal mock Express request. */
const makeReq = (overrides: Record<string, any> = {}): any => ({
  params: {},
  query: {},
  body: {},
  user: { id: 'u1' },
  ...overrides,
})

// ============================================================================
// Tests
// ============================================================================

describe('GlossaryController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --------------------------------------------------------------------------
  // Task Endpoints
  // --------------------------------------------------------------------------

  describe('listTasks', () => {
    it('returns tasks as JSON', async () => {
      const res = makeRes()
      mockService.listTasks.mockResolvedValueOnce([{ id: 't1' }])

      await GlossaryController.listTasks(makeReq(), res)

      expect(res.json).toHaveBeenCalledWith([{ id: 't1' }])
    })

    it('returns 500 on error', async () => {
      const res = makeRes()
      mockService.listTasks.mockRejectedValueOnce(new Error('boom'))

      await GlossaryController.listTasks(makeReq(), res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('getTask', () => {
    it('returns task by ID', async () => {
      const res = makeRes()
      mockService.getTask.mockResolvedValueOnce({ id: 't1' })

      await GlossaryController.getTask(makeReq({ params: { id: 't1' } }), res)

      expect(res.json).toHaveBeenCalledWith({ id: 't1' })
    })

    it('returns 404 when task not found', async () => {
      const res = makeRes()
      mockService.getTask.mockResolvedValueOnce(undefined)

      await GlossaryController.getTask(makeReq({ params: { id: 'missing' } }), res)

      expect(res.status).toHaveBeenCalledWith(404)
    })

    it('returns 500 on error', async () => {
      const res = makeRes()
      mockService.getTask.mockRejectedValueOnce(new Error('fail'))

      await GlossaryController.getTask(makeReq({ params: { id: 't1' } }), res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('createTask', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = makeRes()

      await GlossaryController.createTask(makeReq({ body: {} }), res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('returns 201 on success', async () => {
      const res = makeRes()
      const body = {
        name: 'My task',
        task_instruction_en: 'Translate',
        context_template: '{keyword}',
      }
      mockService.createTask.mockResolvedValueOnce({ id: 't1', ...body })

      await GlossaryController.createTask(makeReq({ body }), res)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
    })

    it('returns 409 on unique constraint violation', async () => {
      const res = makeRes()
      const body = { name: 'Dup', task_instruction_en: 'x', context_template: 'y' }
      mockService.createTask.mockRejectedValueOnce(new Error('unique constraint'))

      await GlossaryController.createTask(makeReq({ body }), res)

      expect(res.status).toHaveBeenCalledWith(409)
    })

    it('returns 500 on generic error', async () => {
      const res = makeRes()
      const body = { name: 'X', task_instruction_en: 'x', context_template: 'y' }
      mockService.createTask.mockRejectedValueOnce(new Error('unexpected'))

      await GlossaryController.createTask(makeReq({ body }), res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('updateTask', () => {
    it('returns updated task', async () => {
      const res = makeRes()
      mockService.updateTask.mockResolvedValueOnce({ id: 't1', name: 'Updated' })

      await GlossaryController.updateTask(makeReq({ params: { id: 't1' }, body: { name: 'Updated' } }), res)

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated' }))
    })

    it('returns 404 when task not found', async () => {
      const res = makeRes()
      mockService.updateTask.mockResolvedValueOnce(undefined)

      await GlossaryController.updateTask(makeReq({ params: { id: 'x' }, body: {} }), res)

      expect(res.status).toHaveBeenCalledWith(404)
    })

    it('returns 409 on unique constraint', async () => {
      const res = makeRes()
      mockService.updateTask.mockRejectedValueOnce(new Error('unique constraint'))

      await GlossaryController.updateTask(makeReq({ params: { id: 't1' }, body: { name: 'Dup' } }), res)

      expect(res.status).toHaveBeenCalledWith(409)
    })

    it('returns 500 on error', async () => {
      const res = makeRes()
      mockService.updateTask.mockRejectedValueOnce(new Error('fail'))

      await GlossaryController.updateTask(makeReq({ params: { id: 't1' }, body: {} }), res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('deleteTask', () => {
    it('returns 204 on success', async () => {
      const res = makeRes()
      mockService.deleteTask.mockResolvedValueOnce(undefined)

      await GlossaryController.deleteTask(makeReq({ params: { id: 't1' } }), res)

      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.send).toHaveBeenCalled()
    })

    it('returns 500 on error', async () => {
      const res = makeRes()
      mockService.deleteTask.mockRejectedValueOnce(new Error('fail'))

      await GlossaryController.deleteTask(makeReq({ params: { id: 't1' } }), res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  // --------------------------------------------------------------------------
  // Keyword Endpoints
  // --------------------------------------------------------------------------

  describe('listKeywords', () => {
    it('returns keywords as JSON', async () => {
      const res = makeRes()
      mockService.listKeywords.mockResolvedValueOnce([{ id: 'k1' }])

      await GlossaryController.listKeywords(makeReq(), res)

      expect(res.json).toHaveBeenCalledWith([{ id: 'k1' }])
    })

    it('returns 500 on error', async () => {
      const res = makeRes()
      mockService.listKeywords.mockRejectedValueOnce(new Error('boom'))

      await GlossaryController.listKeywords(makeReq(), res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('createKeyword', () => {
    it('returns 400 when name is missing', async () => {
      const res = makeRes()

      await GlossaryController.createKeyword(makeReq({ body: {} }), res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('returns 201 on success', async () => {
      const res = makeRes()
      mockService.createKeyword.mockResolvedValueOnce({ id: 'k1', name: 'Test' })

      await GlossaryController.createKeyword(makeReq({ body: { name: 'Test' } }), res)

      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('returns 409 on unique constraint', async () => {
      const res = makeRes()
      mockService.createKeyword.mockRejectedValueOnce(new Error('unique'))

      await GlossaryController.createKeyword(makeReq({ body: { name: 'Dup' } }), res)

      expect(res.status).toHaveBeenCalledWith(409)
    })

    it('returns 500 on generic error', async () => {
      const res = makeRes()
      mockService.createKeyword.mockRejectedValueOnce(new Error('unexpected'))

      await GlossaryController.createKeyword(makeReq({ body: { name: 'X' } }), res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('updateKeyword', () => {
    it('returns updated keyword', async () => {
      const res = makeRes()
      mockService.updateKeyword.mockResolvedValueOnce({ id: 'k1', name: 'Updated' })

      await GlossaryController.updateKeyword(makeReq({ params: { id: 'k1' }, body: { name: 'Updated' } }), res)

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated' }))
    })

    it('returns 404 when keyword not found', async () => {
      const res = makeRes()
      mockService.updateKeyword.mockResolvedValueOnce(undefined)

      await GlossaryController.updateKeyword(makeReq({ params: { id: 'x' }, body: {} }), res)

      expect(res.status).toHaveBeenCalledWith(404)
    })

    it('returns 409 on unique constraint', async () => {
      const res = makeRes()
      mockService.updateKeyword.mockRejectedValueOnce(new Error('unique'))

      await GlossaryController.updateKeyword(makeReq({ params: { id: 'k1' }, body: { name: 'Dup' } }), res)

      expect(res.status).toHaveBeenCalledWith(409)
    })

    it('returns 500 on error', async () => {
      const res = makeRes()
      mockService.updateKeyword.mockRejectedValueOnce(new Error('fail'))

      await GlossaryController.updateKeyword(makeReq({ params: { id: 'k1' }, body: {} }), res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('deleteKeyword', () => {
    it('returns 204 on success', async () => {
      const res = makeRes()
      mockService.deleteKeyword.mockResolvedValueOnce(undefined)

      await GlossaryController.deleteKeyword(makeReq({ params: { id: 'k1' } }), res)

      expect(res.status).toHaveBeenCalledWith(204)
    })

    it('returns 500 on error', async () => {
      const res = makeRes()
      mockService.deleteKeyword.mockRejectedValueOnce(new Error('fail'))

      await GlossaryController.deleteKeyword(makeReq({ params: { id: 'k1' } }), res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  // --------------------------------------------------------------------------
  // Prompt Builder Endpoints
  // --------------------------------------------------------------------------

  describe('search', () => {
    it('returns empty result for blank query', async () => {
      const res = makeRes()

      await GlossaryController.search(makeReq({ query: { q: '  ' } }), res)

      expect(res.json).toHaveBeenCalledWith({ tasks: [], keywords: [] })
      expect(mockService.search).not.toHaveBeenCalled()
    })

    it('delegates to service for non-blank query', async () => {
      const res = makeRes()
      mockService.search.mockResolvedValueOnce({ tasks: [], keywords: [] })

      await GlossaryController.search(makeReq({ query: { q: 'test' } }), res)

      expect(mockService.search).toHaveBeenCalledWith('test')
    })

    it('returns 500 on error', async () => {
      const res = makeRes()
      mockService.search.mockRejectedValueOnce(new Error('fail'))

      await GlossaryController.search(makeReq({ query: { q: 'test' } }), res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('generatePrompt', () => {
    it('returns 400 when taskId or keywordIds are missing', async () => {
      const res = makeRes()

      await GlossaryController.generatePrompt(makeReq({ body: {} }), res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('returns 400 when keywordIds is not an array', async () => {
      const res = makeRes()

      await GlossaryController.generatePrompt(makeReq({ body: { taskId: 't1', keywordIds: 'not-array' } }), res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('returns generated prompt on success', async () => {
      const res = makeRes()
      mockService.generatePrompt.mockResolvedValueOnce('generated prompt text')

      await GlossaryController.generatePrompt(makeReq({ body: { taskId: 't1', keywordIds: ['k1'] } }), res)

      expect(res.json).toHaveBeenCalledWith({ prompt: 'generated prompt text' })
    })

    it('returns 500 on error', async () => {
      const res = makeRes()
      mockService.generatePrompt.mockRejectedValueOnce(new Error('fail'))

      await GlossaryController.generatePrompt(makeReq({ body: { taskId: 't1', keywordIds: ['k1'] } }), res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  // --------------------------------------------------------------------------
  // Bulk Import Endpoints
  // --------------------------------------------------------------------------

  describe('bulkImport', () => {
    it('returns 400 when rows is empty or missing', async () => {
      const res = makeRes()

      await GlossaryController.bulkImport(makeReq({ body: {} }), res)
      expect(res.status).toHaveBeenCalledWith(400)

      const res2 = makeRes()
      await GlossaryController.bulkImport(makeReq({ body: { rows: [] } }), res2)
      expect(res2.status).toHaveBeenCalledWith(400)
    })

    it('delegates to service and returns result', async () => {
      const res = makeRes()
      const result = { success: true, tasksCreated: 1, skipped: 0, errors: [] }
      mockService.bulkImport.mockResolvedValueOnce(result)

      const rows = [{ task_name: 'A', task_instruction_en: 'x', context_template: 'y' }]
      await GlossaryController.bulkImport(makeReq({ body: { rows } }), res)

      expect(mockService.bulkImport).toHaveBeenCalledWith(rows, 'u1')
      expect(res.json).toHaveBeenCalledWith(result)
    })

    it('returns 500 on error', async () => {
      const res = makeRes()
      mockService.bulkImport.mockRejectedValueOnce(new Error('fail'))

      await GlossaryController.bulkImport(makeReq({ body: { rows: [{ task_name: 'A' }] } }), res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('bulkImportKeywords', () => {
    it('returns 400 when rows is empty or missing', async () => {
      const res = makeRes()

      await GlossaryController.bulkImportKeywords(makeReq({ body: {} }), res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('delegates to service and returns result', async () => {
      const res = makeRes()
      const result = { success: true, created: 2, skipped: 0, errors: [] }
      mockService.bulkImportKeywords.mockResolvedValueOnce(result)

      await GlossaryController.bulkImportKeywords(makeReq({ body: { rows: [{ name: 'A' }] } }), res)

      expect(mockService.bulkImportKeywords).toHaveBeenCalledWith([{ name: 'A' }], 'u1')
      expect(res.json).toHaveBeenCalledWith(result)
    })

    it('returns 500 on error', async () => {
      const res = makeRes()
      mockService.bulkImportKeywords.mockRejectedValueOnce(new Error('fail'))

      await GlossaryController.bulkImportKeywords(makeReq({ body: { rows: [{ name: 'X' }] } }), res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })
})
