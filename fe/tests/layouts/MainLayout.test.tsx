import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock all external dependencies before importing the component
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    Outlet: () => React.createElement('div', { 'data-testid': 'outlet' }, 'Content'),
    useLocation: () => ({ pathname: '/' }),
    Link: actual.Link,
    NavLink: actual.NavLink
  }
})

vi.mock('lucide-react', () => {
  const mockIcon = () => React.createElement('span', {}, 'Icon')
  return new Proxy({}, {
    get: () => mockIcon
  })
})

vi.mock('@/features/broadcast/components/BroadcastBanner', () => ({
  default: () => null
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', displayName: 'Test User', email: 't@test.com', role: 'admin' } })
}))

vi.mock('@/app/contexts/SettingsContext', () => ({
  useSettings: () => ({ openSettings: vi.fn(), resolvedTheme: 'light' })
}))

vi.mock('@/features/knowledge-base', () => ({
  useKnowledgeBase: () => ({
    config: { chatSources: [], searchSources: [] },
    selectedChatSourceId: null,
    selectedSearchSourceId: null,
    setSelectedChatSource: vi.fn(),
    setSelectedSearchSource: vi.fn()
  })
}))

vi.mock('../../src/config', () => ({
  config: {
    features: {
      enableAiChat: true,
      enableAiSearch: true,
      enableHistory: true
    }
  }
}))

// Mock the image imports
vi.mock('../../src/assets/logo.png', () => ({ default: 'logo.png' }))
vi.mock('../../src/assets/logo-dark.png', () => ({ default: 'logo-dark.png' }))

import Layout from '../../src/layouts/MainLayout'

describe('MainLayout', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    )
    expect(container).toBeTruthy()
  })

  it('shows user display name', () => {
    const { container } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    )
    expect(container.textContent).toContain('Test User')
  })

  it('renders logo image', () => {
    const { container } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    )
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
  })
})
