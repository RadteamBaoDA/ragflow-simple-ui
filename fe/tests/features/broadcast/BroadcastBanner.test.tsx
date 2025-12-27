import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const vi_mockBroadcastService = vi.hoisted(() => ({
  getActiveMessages: vi.fn()
}))
vi.mock('../../../src/features/broadcast/api/broadcastMessageService', () => ({ broadcastMessageService: vi_mockBroadcastService }))
vi.mock('react-i18next', () => ({ 
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} }
}))
vi.mock('../../../src/features/auth/hooks/useAuth', () => ({ useAuth: vi.fn(() => ({ user: null })) }))
vi.mock('lucide-react', () => ({ X: () => <div data-testid="x-icon" /> }))

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    clear: () => { store = {} }
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true })

import BroadcastBanner from '../../../src/features/broadcast/components/BroadcastBanner'

describe('BroadcastBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify([])))) as any
    localStorageMock.clear()
  })

  it('renders nothing when no messages', async () => {
    vi_mockBroadcastService.getActiveMessages.mockResolvedValue([])
    const { container } = render(<BroadcastBanner />)
    await waitFor(() => expect(container.firstChild).toBeNull())
  })

  it('renders messages', async () => {
    const msg = { id: '1', message: 'Test', color: '#FF0000', font_color: '#FFFFFF', is_dismissible: false }
    vi_mockBroadcastService.getActiveMessages.mockResolvedValue([msg])
    render(<BroadcastBanner />)
    await waitFor(() => expect(screen.getByText('Test')).toBeInTheDocument())
  })

  it('dismisses message and saves to localStorage', async () => {
    const msg = { id: '1', message: 'Test', color: '#FF0000', font_color: '#FFFFFF', is_dismissible: true }
    vi_mockBroadcastService.getActiveMessages.mockResolvedValue([msg])
    render(<BroadcastBanner />)
    await waitFor(() => expect(screen.getByText('Test')).toBeInTheDocument())
    fireEvent.click(screen.getByText('common.hide'))
    await waitFor(() => expect(screen.queryByText('Test')).not.toBeInTheDocument())
    expect(localStorageMock.getItem('dismissed_broadcasts_v2')).toBeTruthy()
  })

  it('loads dismissed messages from localStorage', async () => {
    const msg = { id: '1', message: 'Test', color: '#FF0000', font_color: '#FFFFFF', is_dismissible: false }
    localStorageMock.setItem('dismissed_broadcasts_v2', JSON.stringify({ '1': Date.now() }))
    vi_mockBroadcastService.getActiveMessages.mockResolvedValue([msg])
    const { container } = render(<BroadcastBanner />)
    await waitFor(() => expect(container.firstChild).toBeNull())
  })

  it('applies custom colors', async () => {
    const msg = { id: '1', message: 'Test', color: '#0000FF', font_color: '#00FF00', is_dismissible: false }
    vi_mockBroadcastService.getActiveMessages.mockResolvedValue([msg])
    const { container } = render(<BroadcastBanner />)
    await waitFor(() => {
      const elem = container.querySelector('[style*="color"]')
      expect(elem).toHaveStyle('backgroundColor: #0000FF')
    })
  })

  it('hides button for non-dismissible messages', async () => {
    const msg = { id: '1', message: 'Test', color: '#FF0000', font_color: '#FFFFFF', is_dismissible: false }
    vi_mockBroadcastService.getActiveMessages.mockResolvedValue([msg])
    render(<BroadcastBanner />)
    await waitFor(() => expect(screen.queryByTestId('x-icon')).not.toBeInTheDocument())
  })

  it('refetches when user changes', async () => {
    const { useAuth: mockUseAuth } = await import('../../../src/features/auth/hooks/useAuth')
    const msg = { id: '1', message: 'Test', color: '#FF0000', font_color: '#FFFFFF', is_dismissible: false }
    vi_mockBroadcastService.getActiveMessages.mockResolvedValue([msg])
    vi.mocked(mockUseAuth).mockReturnValue({ user: { id: '2' } as any })
    render(<BroadcastBanner />)
    await waitFor(() => expect(vi_mockBroadcastService.getActiveMessages).toHaveBeenCalled())
  })
})