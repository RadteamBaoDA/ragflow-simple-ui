import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
const vi_mockAuth = vi.hoisted(() => vi.fn(() => ({ user: { role: 'admin' } })))
vi.mock('../../../src/features/auth', () => ({ useAuth: vi_mockAuth }))
vi.mock('lucide-react', () => ({ Search: () => null, Filter: () => null, Clock: () => null, User: () => null, FileText: () => null, Globe: () => null, RefreshCw: () => null, ChevronLeft: () => null, ChevronRight: () => null, X: () => null, Calendar: () => null }))

import AuditLogPage from '../../../src/features/audit/pages/AuditLogPage'

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default fetch handler that provides action types and resource types
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/audit/actions')) return Promise.resolve(new Response(JSON.stringify(['login', 'logout'])))
      if (url.includes('/api/audit/resource-types')) return Promise.resolve(new Response(JSON.stringify(['user', 'document'])))
      return Promise.resolve(new Response(JSON.stringify({ data: [], pagination: {} })))
    }) as any
  })

  it('shows no perm for non-admin', () => {
    vi_mockAuth.mockReturnValueOnce({ user: { role: 'user' } })
    render(<AuditLogPage />)
    expect(screen.getByText('auditLog.noPermission')).toBeInTheDocument()
  })

  it('fetches and displays logs', async () => {
    const logs = [{ id: 1, user_id: 'u1', user_email: 't@e.com', action: 'login', resource_type: 'user', resource_id: null, details: {}, ip_address: '1.1.1.1', created_at: new Date().toISOString() }]
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/audit?')) return Promise.resolve(new Response(JSON.stringify({ data: logs, pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } })))
      if (url.includes('/api/audit/actions')) return Promise.resolve(new Response(JSON.stringify(['login'])))
      if (url.includes('/api/audit/resource-types')) return Promise.resolve(new Response(JSON.stringify(['user'])))
      return Promise.resolve(new Response(null))
    }) as any

    render(<AuditLogPage />)
    await waitFor(() => expect(screen.getByText('t@e.com')).toBeInTheDocument())
  })

  it('handles fetch error', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 500 })))
    render(<AuditLogPage />)
    await waitFor(() => expect(screen.getByText('auditLog.fetchError')).toBeInTheDocument())
  })

  it('toggles filter panel', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/audit/actions')) return Promise.resolve(new Response(JSON.stringify(['login', 'logout'])))
      if (url.includes('/api/audit/resource-types')) return Promise.resolve(new Response(JSON.stringify(['user'])))
      return Promise.resolve(new Response(JSON.stringify({ data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } })))
    }) as any
    render(<AuditLogPage />)
    fireEvent.click(screen.getByText('auditLog.filters'))
    await waitFor(() => expect(screen.getByText('auditLog.filterBy')).toBeInTheDocument())
  })

  it('updates search', () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } })))) as any
    render(<AuditLogPage />)
    const inp = screen.getByPlaceholderText('auditLog.searchPlaceholder')
    fireEvent.change(inp, { target: { value: 'test' } })
    expect(inp).toHaveValue('test')
  })

  it('clears filters', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/audit/actions')) return Promise.resolve(new Response(JSON.stringify(['login'])))
      if (url.includes('/api/audit/resource-types')) return Promise.resolve(new Response(JSON.stringify(['user'])))
      return Promise.resolve(new Response(JSON.stringify({ data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } })))
    }) as any
    render(<AuditLogPage />)
    fireEvent.click(screen.getByText('auditLog.filters'))
    const inp = screen.getByPlaceholderText('auditLog.searchPlaceholder')
    fireEvent.change(inp, { target: { value: 'test' } })
    const clr = await screen.findByText('auditLog.clearFilters')
    fireEvent.click(clr)
    expect(inp).toHaveValue('')
  })

  it('shows empty state', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/audit/actions')) return Promise.resolve(new Response(JSON.stringify(['login'])))
      if (url.includes('/api/audit/resource-types')) return Promise.resolve(new Response(JSON.stringify(['user'])))
      return Promise.resolve(new Response(JSON.stringify({ data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } })))
    }) as any
    render(<AuditLogPage />)
    await waitFor(() => expect(screen.getByText('auditLog.noLogs')).toBeInTheDocument())
  })
})
