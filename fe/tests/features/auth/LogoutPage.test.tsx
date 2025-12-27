import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const vi_mockSettings = vi.hoisted(() => vi.fn(() => ({ isDarkMode: false, resolvedTheme: 'light' })))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/app/contexts/SettingsContext', () => ({ useSettings: vi_mockSettings }))
vi.mock('lucide-react', () => ({ Loader: () => <div data-testid="loader" /> }))

import LogoutPage from '../../../src/features/auth/pages/LogoutPage'

describe('LogoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (window as any).location
    ;(window as any).location = { href: '' }
  })

  it('shows spinner on mount', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    const { container } = render(<LogoutPage />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('calls logout endpoint', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null)))
    render(<LogoutPage />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/logout'), expect.any(Object)))
  })

  it('redirects to login on success', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null)))
    render(<LogoutPage />)
    await waitFor(() => expect((window as any).location.href).toBe('/login'))
  })

  it('applies dark theme', () => {
    vi_mockSettings.mockReturnValueOnce({ isDarkMode: true, resolvedTheme: 'dark' })
    render(<LogoutPage />)
    expect(document.documentElement).toHaveClass('dark')
  })
})
