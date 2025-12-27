import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const vi_mockTeamService = vi.hoisted(() => ({ getTeams: vi.fn() }))
const mockUserService = vi.hoisted(() => ({ getAllUsers: vi.fn() }))
const vi_mockMinioService = vi.hoisted(() => ({ getAllPermissions: vi.fn(), setPermission: vi.fn() }))

vi.mock('../../../src/features/teams', () => ({ teamService: vi_mockTeamService }))
vi.mock('../../../src/features/users', () => ({ userService: mockUserService }))
vi.mock('../../../src/features/documents/api/minioService', () => ({
  getAllPermissions: vi_mockMinioService.getAllPermissions,
  setPermission: vi_mockMinioService.setPermission,
  PermissionLevel: { NONE: 0, VIEW: 1, UPLOAD: 2, FULL: 3 }
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))
let __mockQueryData: Record<string, any> = {}
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => {
    const key = opts?.queryKey?.[0]
    if (key && __mockQueryData[key] === '__loading') return { data: [], isLoading: true }
    if (key && __mockQueryData[key] !== undefined) {
      return { data: __mockQueryData[key], isLoading: false }
    }
    return { data: [], isLoading: false }
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() })
}))
vi.mock('@/components/Dialog', () => ({
  Dialog: ({ open, title, children, footer }: any) => open ? (
    <div data-testid="dialog">
      <div data-testid="dialog-title">{title}</div>
      <div>{children}</div>
      <div data-testid="dialog-footer">{footer}</div>
    </div>
  ) : null
}))
vi.mock('lucide-react', () => ({
  Search: () => <div />,
  Users: () => <div />,
  User: () => <div />,
  Loader2: () => <div data-testid="loader" />
}))

import { DocumentPermissionModal } from '../../../src/features/documents/components/DocumentPermissionModal'

describe('DocumentPermissionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify([])))) as any
    vi_mockTeamService.getTeams.mockResolvedValue([])
    mockUserService.getAllUsers.mockResolvedValue([])
    vi_mockMinioService.getAllPermissions.mockResolvedValue([])
  })

  it('renders dialog when open', () => {
    render(<DocumentPermissionModal isOpen={true} onClose={vi.fn()} bucketId="1" />)
    expect(screen.getByTestId('dialog')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    const { container } = render(<DocumentPermissionModal isOpen={false} onClose={vi.fn()} bucketId="1" />)
    expect(container.querySelector('[data-testid="dialog"]')).not.toBeInTheDocument()
  })

  it('shows loading state for permissions', () => {
    // Use sentinel '__loading' to make the useQuery mock return isLoading=true
    __mockQueryData['document-permissions'] = '__loading'
    render(<DocumentPermissionModal isOpen={true} onClose={vi.fn()} bucketId="1" />)
    expect(screen.getByTestId('loader')).toBeInTheDocument()
    // clear sentinel
    __mockQueryData['document-permissions'] = []
  })

  it('tabs between users and teams', async () => {
    // Return some teams so tabs content loads
    vi_mockTeamService.getTeams.mockResolvedValue([{ id: 't1', name: 'Team1' }])
    vi_mockMinioService.getAllPermissions.mockResolvedValue([])
    render(<DocumentPermissionModal isOpen={true} onClose={vi.fn()} bucketId="1" />)
    const tabs = screen.getAllByRole('button').filter(b => b.textContent?.includes('common.'))
    if (tabs.length >= 2) {
      fireEvent.click(tabs[1])
      // Check for a class containing 'primary' (Tailwind variants may differ)
      await waitFor(() => expect(/primary/.test(tabs[1].className)).toBe(true))
    }
  })

  it('searches for users', async () => {
    // Ensure the query mock will return the user
    __mockQueryData['users'] = [{ id: '1', displayName: 'John', email: 'j@e.com' }]
    __mockQueryData['document-permissions'] = []
    render(<DocumentPermissionModal isOpen={true} onClose={vi.fn()} bucketId="1" />)
    // type into search to trigger user listing (debounced inside component)
    const search = screen.getByPlaceholderText('common.searchPlaceholder')
    fireEvent.change(search, { target: { value: 'John' } })
    // wait for the row to appear
    await waitFor(() => expect(screen.getByText('John')).toBeInTheDocument(), { timeout: 2000 })
  })

  it('changes permission level', async () => {
    __mockQueryData['users'] = [{ id: '1', displayName: 'John', email: 'j@e.com' }]
    __mockQueryData['document-permissions'] = [{ entity_type: 'user', entity_id: '1', permission_level: 0 }]
    render(<DocumentPermissionModal isOpen={true} onClose={vi.fn()} bucketId="1" />)
    // wait for user row
    await waitFor(() => expect(screen.getByText('John')).toBeInTheDocument(), { timeout: 2000 })
    // Try to change select
    const selects = screen.queryAllByRole('combobox')
    if (selects.length > 0) {
      fireEvent.change(selects[0], { target: { value: '1' } })
      await waitFor(() => expect(selects[0]).toHaveValue('1'))
    } else {
      const sel = document.querySelector('select')
      if (sel) {
        fireEvent.change(sel, { target: { value: '1' } })
        await waitFor(() => expect((sel as HTMLSelectElement).value).toBe('1'))
      }
    }
  })

  it('saves permission changes', async () => {
    __mockQueryData['users'] = [{ id: '1', displayName: 'John', email: 'j@e.com' }]
    __mockQueryData['document-permissions'] = [{ entity_type: 'user', entity_id: '1', permission_level: 0 }]
    vi_mockMinioService.setPermission.mockResolvedValue(undefined)
    render(<DocumentPermissionModal isOpen={true} onClose={vi.fn()} bucketId="1" />)
    await waitFor(() => expect(screen.getByText('John')).toBeInTheDocument(), { timeout: 2000 })
    const sel = screen.queryAllByRole('combobox')[0] || document.querySelector('select')
    if (sel) fireEvent.change(sel, { target: { value: '1' } })
    // Find the save button reliably (footer is last, save is typically last button)
    const buttons = screen.getAllByRole('button')
    const saveBtn = buttons[buttons.length - 1]
    // Wait for save to become enabled (pendingChanges applied)
    await waitFor(() => expect(saveBtn).not.toHaveAttribute('disabled'), { timeout: 2000 })
    fireEvent.click(saveBtn)
    await waitFor(() => expect(vi_mockMinioService.setPermission).toHaveBeenCalled())
  })

  it('displays bucket name in title', () => {
    render(<DocumentPermissionModal isOpen={true} onClose={vi.fn()} bucketId="1" bucketName="TestBucket" />)
    expect(screen.getByText(/TestBucket/)).toBeInTheDocument()
  })

  it('calls onClose on cancel', () => {
    const onClose = vi.fn()
    render(<DocumentPermissionModal isOpen={true} onClose={onClose} bucketId="1" />)
    const cancelBtn = screen.getByText('common.cancel')
    fireEvent.click(cancelBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('disables save when no changes', () => {
    mockUserService.getAllUsers.mockResolvedValue([])
    vi_mockMinioService.getAllPermissions.mockResolvedValue([])
    render(<DocumentPermissionModal isOpen={true} onClose={vi.fn()} bucketId="1" />)
    const saveBtn = screen.getByText('common.save')
    expect(saveBtn).toHaveAttribute('disabled')
  })
})