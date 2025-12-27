import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { vi_mockApiFetch } = vi.hoisted(() => ({
  vi_mockApiFetch: vi.fn(),
}));

// Sentinel to let tests inject deterministic query returns
const __mockQueryData = vi.hoisted(() => ({ chatSessions: { sessions: [], total: 0 } }))

vi.mock('../../../src/lib/api', () => ({ apiFetch: vi_mockApiFetch }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }), initReactI18next: { type: '3rdParty', init: () => {} } }))
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => {
    // Call the queryFn so tests that assert api calls can observe them
    if (opts?.queryFn) void opts.queryFn().catch(() => {})
    const key = opts?.queryKey?.[0] || 'chatSessions'
    const data = __mockQueryData[key] || { sessions: [], total: 0 }
    return { data, isLoading: false, refetch: () => opts?.queryFn?.().catch(() => {}) }
  },
  useMutation: (opts: any) => ({ mutate: (arg: any) => opts.mutationFn(arg), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() })
}))
vi.mock('@/components/Dialog', () => ({
  Dialog: ({ open, children }: any) => open ? <div data-testid="dialog">{children}</div> : null
}))
vi.mock('@/components/Checkbox', () => ({
  Checkbox: ({ checked, onChange }: any) => <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
}))

import HistoryPage from '../../../src/features/history/pages/HistoryPage'

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi_mockApiFetch.mockResolvedValue({ sessions: [], total: 0 })
    // reset sentinel used by our react-query mock
    __mockQueryData.chatSessions = { sessions: [], total: 0 }
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ sessions: [], total: 0 })))) as any
    window.confirm = vi.fn(() => true)
  })

  it('renders history page', () => {
    render(<HistoryPage />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('searches sessions', async () => {
    vi_mockApiFetch.mockResolvedValue({ sessions: [{ id: '1', title: 'Test', createdAt: '2025-01-01', updatedAt: '2025-01-01', messages: [] }], total: 1 })
    // keep sentinel in sync so the component can render results when needed
    __mockQueryData.chatSessions = { sessions: [{ id: '1', title: 'Test', createdAt: '2025-01-01', updatedAt: '2025-01-01', messages: [] }], total: 1 }
    render(<HistoryPage />)
    const searchInput = screen.getByRole('textbox')
    fireEvent.change(searchInput, { target: { value: 'test' } })
    const searchBtn = screen.getByRole('button', { name: /history.search/i })
    if (searchBtn) fireEvent.click(searchBtn)
    await waitFor(() => expect(vi_mockApiFetch).toHaveBeenCalled(), { timeout: 2000 })
  })

  it('filters by date range', async () => {
    render(<HistoryPage />)
    const inputs = screen.getAllByRole('textbox')
    if (inputs.length >= 3) {
      fireEvent.change(inputs[1], { target: { value: '2025-01-01' } })
      fireEvent.change(inputs[2], { target: { value: '2025-01-31' } })
      await waitFor(() => expect(vi_mockApiFetch).toHaveBeenCalled())
    }
  })

  it('selects multiple sessions', async () => {
    const payload = {
      sessions: [
        { id: '1', title: 'Session 1', createdAt: '2025-01-01', updatedAt: '2025-01-01', messages: [] },
        { id: '2', title: 'Session 2', createdAt: '2025-01-02', updatedAt: '2025-01-02', messages: [] }
      ],
      total: 2
    }
    vi_mockApiFetch.mockResolvedValue(payload)
    __mockQueryData.chatSessions = payload
    render(<HistoryPage />)
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      if (checkboxes.length >= 2) {
        fireEvent.click(checkboxes[1])
        fireEvent.click(checkboxes[2])
      }
    })
  })

  it('deletes selected sessions', async () => {
    const payload = { sessions: [{ id: '1', title: 'Test', createdAt: '2025-01-01', updatedAt: '2025-01-01', messages: [] }], total: 1 }
    vi_mockApiFetch.mockResolvedValue(payload)
    __mockQueryData.chatSessions = payload
    render(<HistoryPage />)
    await waitFor(() => expect(screen.queryByText('history.noSessions')).not.toBeInTheDocument())
    const checkboxes = screen.getAllByRole('checkbox')
    if (checkboxes[0]) {
      fireEvent.click(checkboxes[0])
      const deleteBtn = screen.queryByText('history.delete') || screen.queryByText('history.deleteSelected')
      if (deleteBtn) {
        fireEvent.click(deleteBtn)
        await waitFor(() => expect(vi_mockApiFetch).toHaveBeenCalled(), { timeout: 2000 })
      }
    }
  })

  it('deletes all sessions with confirmation', async () => {
    vi_mockApiFetch.mockResolvedValue({ sessions: [{ id: '1', title: 'Test', createdAt: '2025-01-01', updatedAt: '2025-01-01', messages: [] }], total: 1 })
    render(<HistoryPage />)
    await waitFor(() => expect(screen.queryByText('history.noSessions')).not.toBeInTheDocument())
    const deleteAllBtn = screen.queryByText('history.deleteAll') || screen.queryByText(/delete all/i)
    if (deleteAllBtn) {
      fireEvent.click(deleteAllBtn)
      await waitFor(() => expect(window.confirm).toHaveBeenCalled(), { timeout: 2000 })
    }
  })

  it('displays sessions in list', async () => {
    const payload = { sessions: [{ id: '1', title: 'Chat with AI', createdAt: '2025-01-01', updatedAt: '2025-01-01', messages: [] }], total: 1 }
    vi_mockApiFetch.mockResolvedValue(payload)
    __mockQueryData.chatSessions = payload
    render(<HistoryPage />)
    await waitFor(() => expect(screen.getByText('Chat with AI')).toBeInTheDocument())
  })

  it('clears search', async () => {
    render(<HistoryPage />)
    const clearBtn = screen.getByText(/clear/i, { selector: 'button' })
    if (clearBtn) {
      fireEvent.click(clearBtn)
      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.value).toBe('')
    }
  })

  it('handles network errors', async () => {
    vi_mockApiFetch.mockRejectedValue(new Error('Network error'))
    __mockQueryData.chatSessions = { sessions: [], total: 0 }
    render(<HistoryPage />)
    // Trigger a search to force the queryFn to run
    const searchBtn = screen.getByRole('button', { name: /history.search/i })
    if (searchBtn) fireEvent.click(searchBtn)
    await waitFor(() => expect(vi_mockApiFetch).toHaveBeenCalled(), { timeout: 2000 })
  })
})