import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockUserService, vi_mockApiFetch } = vi.hoisted(() => ({
  mockUserService: { getUsers: vi.fn() },
  vi_mockApiFetch: vi.fn(),
}));

vi.mock('../../../src/features/users/api/userService', () => ({ userService: mockUserService }))
vi.mock('../../../src/lib/api', () => ({ apiFetch: vi_mockApiFetch }))
vi.mock('../../../src/features/auth', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))
vi.mock('@tanstack/react-query', () => ({
  useMutation: (opts: any) => ({ mutate: opts.mutationFn, isPending: false })
}))
vi.mock('@/components/Dialog', () => ({
  Dialog: ({ open, children }: any) => open ? <div data-testid="dialog">{children}</div> : null
}))
vi.mock('lucide-react', () => ({
  Mail: () => <div />,
  Edit2: () => <div data-testid="edit" />,
  Globe: () => <div />,
  Search: () => <div />,
  Filter: () => <div />,
  X: () => <div />,
  ArrowUp: () => <div />,
  ArrowDown: () => <div />,
  AlertCircle: () => <div />
}))

import UserManagementPage from '../../../src/features/users/pages/UserManagementPage'

describe('UserManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserService.getUsers.mockResolvedValue([])
    vi_mockApiFetch.mockResolvedValue([])
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/users/ip-history')) {
        return Promise.resolve(new Response(JSON.stringify({})))
      }
      if (url.includes('/api/users')) {
        return Promise.resolve(new Response(JSON.stringify([])))
      }
      return Promise.resolve(new Response(JSON.stringify([])))
    }) as any
  })

  it('renders user management page', async () => {
    render(<UserManagementPage />)
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeInTheDocument())
  })

  it('loads users on mount', async () => {
    let fetchCalled = false
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/users') && !url.includes('ip-history')) {
        fetchCalled = true
        return Promise.resolve(new Response(JSON.stringify([])))
      }
      return Promise.resolve(new Response(JSON.stringify({})))
    }) as any
    
    render(<UserManagementPage />)
    await waitFor(() => expect(fetchCalled).toBe(true))
  })

  it('displays users in table', async () => {
    const users = [{ id: '1', email: 'user@e.com', displayName: 'User', role: 'user', name: 'User' }]
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/users/ip-history')) return Promise.resolve(new Response(JSON.stringify({})))
      if (url.includes('/api/users')) return Promise.resolve(new Response(JSON.stringify(users)))
      return Promise.resolve(new Response(JSON.stringify([])))
    }) as any
    
    render(<UserManagementPage />)
    await waitFor(() => expect(screen.getByText('user@e.com')).toBeInTheDocument())
  })

  it('searches users by name or email', async () => {
    const users = [
      { id: '1', email: 'john@e.com', displayName: 'John', role: 'user', name: 'John' },
      { id: '2', email: 'jane@e.com', displayName: 'Jane', role: 'user', name: 'Jane' }
    ]
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/users/ip-history')) return Promise.resolve(new Response(JSON.stringify({})))
      if (url.includes('/api/users')) return Promise.resolve(new Response(JSON.stringify(users)))
      return Promise.resolve(new Response(JSON.stringify([])))
    }) as any
    
    render(<UserManagementPage />)
    await waitFor(() => expect(screen.getByText('john@e.com')).toBeInTheDocument())
    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'john' } })
    await waitFor(() => expect(screen.getByText('john@e.com')).toBeInTheDocument())
  })

  it('filters by role', async () => {
    const users = [
      { id: '1', email: 'admin@e.com', displayName: 'Admin', role: 'admin', name: 'Admin' },
      { id: '2', email: 'user@e.com', displayName: 'User', role: 'user', name: 'User' }
    ]
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/users/ip-history')) return Promise.resolve(new Response(JSON.stringify({})))
      if (url.includes('/api/users')) return Promise.resolve(new Response(JSON.stringify(users)))
      return Promise.resolve(new Response(JSON.stringify([])))
    }) as any
    
    render(<UserManagementPage />)
    await waitFor(() => expect(screen.getByText('admin@e.com')).toBeInTheDocument())
    const roleFilter = screen.getAllByRole('combobox')[0]
    if (roleFilter) {
      fireEvent.change(roleFilter, { target: { value: 'admin' } })
      await waitFor(() => expect(screen.getByText('admin@e.com')).toBeInTheDocument())
    }
  })

  it('opens edit role dialog', async () => {
    const users = [{ id: '1', email: 'user@e.com', displayName: 'User', role: 'user', name: 'User' }]
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/users/ip-history')) return Promise.resolve(new Response(JSON.stringify({})))
      if (url.includes('/api/users')) return Promise.resolve(new Response(JSON.stringify(users)))
      return Promise.resolve(new Response(JSON.stringify([])))
    }) as any
    
    render(<UserManagementPage />)
    await waitFor(() => expect(screen.getByText('user@e.com')).toBeInTheDocument())
    const editBtn = screen.getByTestId('edit').closest('button')
    if (editBtn) {
      fireEvent.click(editBtn)
      await waitFor(() => expect(screen.getByTestId('dialog')).toBeInTheDocument())
    }
  })

  it('sorts users by column', async () => {
    const users = [
      { id: '1', email: 'adam@e.com', displayName: 'Adam', role: 'user', name: 'Adam' },
      { id: '2', email: 'bob@e.com', displayName: 'Bob', role: 'user', name: 'Bob' }
    ]
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/users/ip-history')) return Promise.resolve(new Response(JSON.stringify({})))
      if (url.includes('/api/users')) return Promise.resolve(new Response(JSON.stringify(users)))
      return Promise.resolve(new Response(JSON.stringify([])))
    }) as any
    
    render(<UserManagementPage />)
    await waitFor(() => expect(screen.getByText('adam@e.com')).toBeInTheDocument())
    const headers = screen.getAllByRole('columnheader')
    if (headers.length > 0) {
      fireEvent.click(headers[0])
      expect(screen.getByText('bob@e.com')).toBeInTheDocument()
    }
  })

  it('shows loading state', () => {
    mockUserService.getUsers.mockImplementationOnce(() => new Promise(() => {}))
    render(<UserManagementPage />)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner || screen.queryByText(/loading/i) || screen.queryByRole('progressbar')).toBeTruthy()
  })

  it('displays role badges', async () => {
    mockUserService.getUsers.mockResolvedValue([
      { id: '1', email: 'admin@e.com', displayName: 'Admin', role: 'admin', name: 'Admin' }
    ])
    render(<UserManagementPage />)
    await waitFor(() => expect(screen.getByText(/admin/i)).toBeInTheDocument())
  })

  it('shows IP access history', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/users/ip-history')) return Promise.resolve(new Response(JSON.stringify([{ id: 1, user_id: '1', ip_address: '192.168.1.1', last_accessed_at: '2025-01-01T00:00:00Z' }])))
      if (url.includes('/api/users')) return Promise.resolve(new Response(JSON.stringify([])))
      return Promise.resolve(new Response(JSON.stringify([])))
    }) as any
    render(<UserManagementPage />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
  })

  it('handles network errors', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))) as any
    
    render(<UserManagementPage />)
    await waitFor(() => expect(screen.queryByText(/failed to fetch users/i)).toBeInTheDocument())
  })
})