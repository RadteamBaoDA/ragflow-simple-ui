/**
 * @fileoverview Unit tests for useGlossaryKeywords hook.
 * Uses renderHook from @testing-library/react and mocks glossaryApi.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGlossaryKeywords } from '../../../src/features/glossary/hooks/useGlossaryKeywords'
import { glossaryApi } from '../../../src/features/glossary/api/glossaryApi'
import type { GlossaryKeyword } from '../../../src/features/glossary/api/glossaryApi'

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../../../src/features/glossary/api/glossaryApi', () => ({
  glossaryApi: {
    listKeywords: vi.fn(),
    createKeyword: vi.fn(),
    updateKeyword: vi.fn(),
    deleteKeyword: vi.fn(),
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

// ============================================================================
// Fixtures
// ============================================================================

const KEYWORDS: GlossaryKeyword[] = [
  {
    id: 'k1',
    name: '契約書',
    en_keyword: 'contract',
    description: 'Legal contract document',
    sort_order: 0,
    is_active: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'k2',
    name: '仕様書',
    en_keyword: 'specification',
    description: 'Technical spec',
    sort_order: 1,
    is_active: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
]

// ============================================================================
// Tests
// ============================================================================

describe('useGlossaryKeywords', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(glossaryApi.listKeywords).mockResolvedValue(KEYWORDS)
  })

  it('fetches keywords on mount when enabled', async () => {
    const { result } = renderHook(() => useGlossaryKeywords(true))

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(glossaryApi.listKeywords).toHaveBeenCalledTimes(1)
    expect(result.current.filteredKeywords).toHaveLength(2)
  })

  it('does not fetch when disabled', async () => {
    renderHook(() => useGlossaryKeywords(false))

    // Give it a tick
    await new Promise((r) => setTimeout(r, 50))

    expect(glossaryApi.listKeywords).not.toHaveBeenCalled()
  })

  it('filters keywords by name', async () => {
    const { result } = renderHook(() => useGlossaryKeywords())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setSearch('契約')
    })

    expect(result.current.filteredKeywords).toHaveLength(1)
    expect(result.current.filteredKeywords[0].name).toBe('契約書')
  })

  it('filters keywords by en_keyword', async () => {
    const { result } = renderHook(() => useGlossaryKeywords())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setSearch('contract')
    })

    expect(result.current.filteredKeywords).toHaveLength(1)
    expect(result.current.filteredKeywords[0].en_keyword).toBe('contract')
  })

  it('filters keywords by description', async () => {
    const { result } = renderHook(() => useGlossaryKeywords())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setSearch('technical')
    })

    expect(result.current.filteredKeywords).toHaveLength(1)
    expect(result.current.filteredKeywords[0].id).toBe('k2')
  })

  it('returns all keywords when search is empty', async () => {
    const { result } = renderHook(() => useGlossaryKeywords())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setSearch('contract'))
    expect(result.current.filteredKeywords).toHaveLength(1)

    act(() => result.current.setSearch(''))
    expect(result.current.filteredKeywords).toHaveLength(2)
  })

  it('openModal in create mode sets default values', async () => {
    const { result } = renderHook(() => useGlossaryKeywords())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.openModal()
    })

    expect(result.current.isModalOpen).toBe(true)
    expect(result.current.editingKeyword).toBeNull()
  })

  it('openModal in edit mode sets editing keyword', async () => {
    const { result } = renderHook(() => useGlossaryKeywords())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.openModal(KEYWORDS[0])
    })

    expect(result.current.isModalOpen).toBe(true)
    expect(result.current.editingKeyword).toEqual(KEYWORDS[0])
  })

  it('closeModal resets state', async () => {
    const { result } = renderHook(() => useGlossaryKeywords())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.openModal())
    expect(result.current.isModalOpen).toBe(true)

    act(() => result.current.closeModal())
    expect(result.current.isModalOpen).toBe(false)
    expect(result.current.editingKeyword).toBeNull()
  })

  it('handleSubmit creates keyword when no editing keyword', async () => {
    vi.mocked(glossaryApi.createKeyword).mockResolvedValueOnce(KEYWORDS[0])
    const { result } = renderHook(() => useGlossaryKeywords())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSubmit({ name: 'New keyword' })
    })

    expect(glossaryApi.createKeyword).toHaveBeenCalledWith({ name: 'New keyword' })
  })

  it('handleSubmit updates keyword when editing', async () => {
    vi.mocked(glossaryApi.updateKeyword).mockResolvedValueOnce(KEYWORDS[0])
    const { result } = renderHook(() => useGlossaryKeywords())

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Set editing mode
    act(() => result.current.openModal(KEYWORDS[0]))

    await act(async () => {
      await result.current.handleSubmit({ name: 'Updated keyword' })
    })

    expect(glossaryApi.updateKeyword).toHaveBeenCalledWith('k1', { name: 'Updated keyword' })
  })

  it('handleSubmit handles errors gracefully', async () => {
    vi.mocked(glossaryApi.createKeyword).mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => useGlossaryKeywords())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSubmit({ name: 'Fail' })
    })

    // Should not throw, submitting should be reset
    expect(result.current.submitting).toBe(false)
  })

  it('refresh re-fetches keywords', async () => {
    const { result } = renderHook(() => useGlossaryKeywords())

    await waitFor(() => expect(result.current.loading).toBe(false))

    vi.mocked(glossaryApi.listKeywords).mockClear()
    vi.mocked(glossaryApi.listKeywords).mockResolvedValueOnce(KEYWORDS)

    await act(async () => {
      result.current.refresh()
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(glossaryApi.listKeywords).toHaveBeenCalledTimes(1)
  })
})
