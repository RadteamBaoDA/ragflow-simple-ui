import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { vi_mockNav, vi_mockAuth, vi_mockSettings } = vi.hoisted(() => ({
  vi_mockNav: vi.fn(),
  vi_mockAuth: vi.fn(),
  vi_mockSettings: vi.fn(() => ({ isDarkMode: false, resolvedTheme: 'light' })),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi_mockNav, useSearchParams: () => [new URLSearchParams(), vi.fn()] }
})
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('../../../src/features/auth/hooks/useAuth', () => ({ useAuth: vi_mockAuth }))
vi.mock('@/app/contexts/SettingsContext', () => ({ useSettings: vi_mockSettings }))
vi.mock('lucide-react', () => ({ Loader: () => <div data-testid="loader" />, X: () => <div data-testid="x-icon" /> }))
vi.mock('@/components/Dialog', () => ({ Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null }))
vi.mock('@/features/broadcast/components/BroadcastBanner', () => ({ default: () => null }))

import LoginPage from '../../../src/features/auth/pages/LoginPage'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi_mockAuth.mockReturnValue({ isAuthenticated: false, isLoading: false })
    delete (window as any).location
    ;(window as any).location = { href: '' }
    // Default fetch handler for auth config
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/auth/config')) return Promise.resolve(new Response(JSON.stringify({ authBaseUrl: 'https://kb.baoda.live' })))
      return Promise.resolve(new Response(null))
    }) as any
  })

  it('renders oauth button', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    expect(screen.queryByRole('button')).toBeInTheDocument()
  })

  it('oauth redirects', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    const btns = screen.queryAllByRole('button')
    if (btns.length > 0) {
      fireEvent.click(btns[0])
      expect((window as any).location.href).toBeTruthy()
    }
  })

  it('redirects authenticated users', () => {
    vi_mockAuth.mockReturnValue({ isAuthenticated: true, isLoading: false })
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    // The app now redirects to '/chat' for authenticated users
    expect(vi_mockNav).toHaveBeenCalledWith('/chat', expect.any(Object))
  })

  it('shows dark theme', () => {
    vi_mockSettings.mockReturnValueOnce({ isDarkMode: true, resolvedTheme: 'dark' })
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    expect(document.documentElement).toHaveClass('dark')
  })

  it('shows loader when loading', () => {
    vi_mockAuth.mockReturnValue({ isAuthenticated: false, isLoading: true })
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    expect(screen.getByText('common.checkingSession')).toBeInTheDocument()
  })
})
