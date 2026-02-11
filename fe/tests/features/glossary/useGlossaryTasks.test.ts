/**
 * @fileoverview Unit tests for useGlossaryTasks hook.
 * Uses renderHook from @testing-library/react and mocks glossaryApi.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGlossaryTasks } from '../../../src/features/glossary/hooks/useGlossaryTasks'
import { glossaryApi } from '../../../src/features/glossary/api/glossaryApi'
import type { GlossaryTask } from '../../../src/features/glossary/api/glossaryApi'

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../../../src/features/glossary/api/glossaryApi', () => ({
  glossaryApi: {
    listTasks: vi.fn(),
    getTask: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}))

vi.mock('../../../src/app/App', () => ({
  globalMessage: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

// Mock antd Form.useForm to avoid internal antd context requirements
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...(actual as any),
    Form: {
      ...(actual as any).Form,
      useForm: () => [{
        setFieldsValue: vi.fn(),
        resetFields: vi.fn(),
        getFieldsValue: vi.fn(),
        validateFields: vi.fn(),
      }],
    },
  }
})

// ============================================================================
// Fixtures
// ============================================================================

const TASKS: GlossaryTask[] = [
  {
    id: 't1',
    name: 'Translate document',
    task_instruction_en: 'Translate the following',
    context_template: '{keyword}',
    sort_order: 0,
    is_active: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 't2',
    name: 'Summarize report',
    task_instruction_en: 'Summarize the following',
    context_template: '{keyword}',
    sort_order: 1,
    is_active: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
]

// ============================================================================
// Tests
// ============================================================================

describe('useGlossaryTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(glossaryApi.listTasks).mockResolvedValue(TASKS)
  })

  it('fetches tasks on mount', async () => {
    const { result } = renderHook(() => useGlossaryTasks())

    // Initially loading
    expect(result.current.loading).toBe(true)

    // Wait for fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(glossaryApi.listTasks).toHaveBeenCalled()
    expect(result.current.tasks).toEqual(TASKS)
  })

  it('filters tasks by search term', async () => {
    const { result } = renderHook(() => useGlossaryTasks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // All tasks when no search
    expect(result.current.filteredTasks).toHaveLength(2)

    // Set search
    act(() => {
      result.current.setSearch('translate')
    })

    expect(result.current.filteredTasks).toHaveLength(1)
    expect(result.current.filteredTasks[0].name).toBe('Translate document')
  })

  it('returns empty when search matches nothing', async () => {
    const { result } = renderHook(() => useGlossaryTasks())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setSearch('nonexistent')
    })

    expect(result.current.filteredTasks).toHaveLength(0)
  })

  it('openModal in create mode resets form', async () => {
    const { result } = renderHook(() => useGlossaryTasks())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.openModal()
    })

    expect(result.current.isModalOpen).toBe(true)
    expect(result.current.editingTask).toBeNull()
  })

  it('openModal in edit mode sets editing task', async () => {
    const { result } = renderHook(() => useGlossaryTasks())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.openModal(TASKS[0])
    })

    expect(result.current.isModalOpen).toBe(true)
    expect(result.current.editingTask).toEqual(TASKS[0])
  })

  it('closeModal resets state', async () => {
    const { result } = renderHook(() => useGlossaryTasks())

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Open then close
    act(() => result.current.openModal())
    act(() => result.current.closeModal())

    expect(result.current.isModalOpen).toBe(false)
  })

  it('handleSubmit creates task when no editingTask', async () => {
    vi.mocked(glossaryApi.createTask).mockResolvedValueOnce(TASKS[0])
    const { result } = renderHook(() => useGlossaryTasks())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSubmit({
        name: 'New',
        task_instruction_en: 'x',
        context_template: 'y',
      })
    })

    expect(glossaryApi.createTask).toHaveBeenCalledWith({
      name: 'New',
      task_instruction_en: 'x',
      context_template: 'y',
    })
  })

  it('handleSubmit updates task when editingTask is set', async () => {
    vi.mocked(glossaryApi.updateTask).mockResolvedValueOnce(TASKS[0])
    const { result } = renderHook(() => useGlossaryTasks())

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Open modal in edit mode
    act(() => {
      result.current.openModal(TASKS[0])
    })

    expect(result.current.editingTask).toEqual(TASKS[0])

    // Fire handleSubmit (source code uses fire-and-forget fetchTasks internally)
    act(() => {
      result.current.handleSubmit({
        name: 'Updated',
        task_instruction_en: 'x',
        context_template: 'y',
      })
    })

    // Wait for updateTask to be called
    await waitFor(() => {
      expect(glossaryApi.updateTask).toHaveBeenCalledWith('t1', {
        name: 'Updated',
        task_instruction_en: 'x',
        context_template: 'y',
      })
    })
  })

  it('handleSubmit handles API errors gracefully', async () => {
    vi.mocked(glossaryApi.createTask).mockRejectedValueOnce(new Error('Server error'))
    const { result } = renderHook(() => useGlossaryTasks())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSubmit({
        name: 'Fail',
        task_instruction_en: 'x',
        context_template: 'y',
      })
    })

    // Should not throw, submitting should be reset
    expect(result.current.submitting).toBe(false)
  })

  it('refresh re-fetches tasks', async () => {
    const { result } = renderHook(() => useGlossaryTasks())

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Reset call count
    vi.mocked(glossaryApi.listTasks).mockClear()
    vi.mocked(glossaryApi.listTasks).mockResolvedValueOnce(TASKS)

    await act(async () => {
      result.current.refresh()
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(glossaryApi.listTasks).toHaveBeenCalled()
  })
})
