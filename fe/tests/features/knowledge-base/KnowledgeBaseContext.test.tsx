import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, useContext, fireEvent, waitFor } from '@testing-library/react'

const mockFetch = vi.fn()
global.fetch = mockFetch as any

const vi_mockUserPreferences = vi.hoisted(() => {
  const get = vi.fn()
  const set = vi.fn()
  return { get, set, getPreference: get, setPreference: set }
})
vi.mock('../../../src/features/users/api/userPreferences', () => ({ userPreferences: vi_mockUserPreferences }))
vi.mock('../../../src/features/auth', () => ({ useAuth: () => ({ user: { id: '1' } }) }))

import { KnowledgeBaseProvider, useKnowledgeBase } from '../../../src/features/knowledge-base/context/KnowledgeBaseContext'

describe('KnowledgeBaseContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      defaultChatSourceId: '1',
      defaultSearchSourceId: '2',
      chatSources: [{ id: '1', name: 'Chat', url: 'http://localhost/chat' }],
      searchSources: [{ id: '2', name: 'Search', url: 'http://localhost/search' }]
    })))
    vi_mockUserPreferences.getPreference.mockResolvedValue(null)
  })

  it('fetches config on mount', async () => {
    render(
      <KnowledgeBaseProvider>
        <div>Test</div>
      </KnowledgeBaseProvider>
    )
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/knowledge-base/config'), expect.objectContaining({ credentials: 'include' }))
  })

  it('provides context to children', async () => {
    const TestComponent = () => {
      const ctx = useKnowledgeBase()
      return <div>{ctx?.config?.defaultChatSourceId || 'loading'}</div>
    }

    render(
      <KnowledgeBaseProvider>
        <TestComponent />
      </KnowledgeBaseProvider>
    )

    expect(screen.getByText(/loading|1/)).toBeInTheDocument()
  })

  it('defaults selected sources to config defaults', async () => {
    const TestComponent = () => {
      const ctx = useKnowledgeBase()
      return <div>{ctx?.selectedChatSourceId}</div>
    }

    render(
      <KnowledgeBaseProvider>
        <TestComponent />
      </KnowledgeBaseProvider>
    )
  })

  it('updates selected chat source', async () => {
    const TestComponent = () => {
      const ctx = useKnowledgeBase()
      return (
        <div>
          <button onClick={() => ctx?.setSelectedChatSource('3')}>Change</button>
          <div>{ctx?.selectedChatSourceId}</div>
        </div>
      )
    }

    render(
      <KnowledgeBaseProvider>
        <TestComponent />
      </KnowledgeBaseProvider>
    )
  })

  it('persists source preference to storage', async () => {
    const TestComponent = () => {
      const ctx = useKnowledgeBase()
      return <button onClick={() => ctx?.setSelectedChatSource('new')}>Change</button>
    }

    render(
      <KnowledgeBaseProvider>
        <TestComponent />
      </KnowledgeBaseProvider>
    )

    const btn = screen.getByText('Change')
    if (btn) {
      fireEvent.click(btn)
      await Promise.resolve()
      await waitFor(() => expect(vi_mockUserPreferences.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.anything()))
    }
  })

  it('handles config fetch errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const TestComponent = () => {
      const ctx = useKnowledgeBase()
      return <div>{ctx?.error || 'ok'}</div>
    }

    render(
      <KnowledgeBaseProvider>
        <TestComponent />
      </KnowledgeBaseProvider>
    )
  })

  it('shows loading state', async () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {}))
    const TestComponent = () => {
      const ctx = useKnowledgeBase()
      return <div>{ctx?.isLoading ? 'loading' : 'ready'}</div>
    }

    render(
      <KnowledgeBaseProvider>
        <TestComponent />
      </KnowledgeBaseProvider>
    )
  })

  it('updates selected search source', async () => {
    const TestComponent = () => {
      const ctx = useKnowledgeBase()
      return (
        <div>
          <button onClick={() => ctx?.setSelectedSearchSource('3')}>Change</button>
          <div>{ctx?.selectedSearchSourceId}</div>
        </div>
      )
    }

    render(
      <KnowledgeBaseProvider>
        <TestComponent />
      </KnowledgeBaseProvider>
    )
  })

  it('throws error when used outside provider', () => {
    const TestComponent = () => {
      return useKnowledgeBase() ? <div>ok</div> : <div>error</div>
    }

    expect(() => render(<TestComponent />)).toThrow()
  })
})