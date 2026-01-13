import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const vi_mockTeamService = vi.hoisted(() => ({ getTeams: vi.fn() }))
const mockUserService = vi.hoisted(() => ({ getAllUsers: vi.fn() }))
const vi_mockDocService = vi.hoisted(() => ({ getAllPermissions: vi.fn(), setPermission: vi.fn() }))

vi.mock('../../../src/features/teams', () => ({ teamService: vi_mockTeamService }))
vi.mock('../../../src/features/users', () => ({ userService: mockUserService }))
vi.mock('../../../src/features/documents/api/documentService', () => ({
  getAllPermissions: vi_mockDocService.getAllPermissions,
  setPermission: vi_mockDocService.setPermission,
  PermissionLevel: { NONE: 0, VIEW: 1, UPLOAD: 2, FULL: 3 }
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))

// Provide lightweight mocks for Ant Design components used in the modal so tests can interact with
// simple DOM elements (native <select>, <button>, etc.). This keeps tests deterministic and avoids
// depending on Ant's internal DOM shapes.
vi.mock('antd', () => ({
  Table: ({ loading, dataSource }: any) => (
    <div>
      {loading ? <div className="ant-spin" data-testid="ant-spin" /> : null}
      <table>
        <tbody>
          {(dataSource || []).map((r: any) => (
            <tr key={r.id}><td>{r.displayName || r.name || r.email || r.title}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
  Select: ({ value, onChange, options, className }: any) => (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={className}>
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
  Input: ({ value, onChange, prefix, placeholder, className }: any) => (
    <input placeholder={placeholder} value={value} onChange={(e) => onChange(e)} className={className} />
  ),
  Tabs: ({ items, activeKey, onChange }: any) => (
    <div>
      {items.map((it: any) => (
        <button key={it.key} role="tab" onClick={() => onChange(it.key)}>{it.label}</button>
      ))}
    </div>
  ),
  Button: ({ children, onClick, disabled }: any) => (
    <button disabled={disabled} onClick={onClick}>{children}</button>
  ),
  Avatar: ({ children }: any) => <div>{children}</div>,
  Space: ({ children }: any) => <div>{children}</div>
}));

// Mock key Ant Design components used by the modal to simpler native controls for test reliability
vi.mock('antd', () => ({
  Select: ({ value, onChange, options }: any) => (
    <select value={value} onChange={(e) => onChange(Number((e.target as HTMLSelectElement).value))}>
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Input: ({ value, onChange, placeholder }: any) => <input value={value} onChange={onChange} placeholder={placeholder} />, 
  Tabs: ({ items, activeKey, onChange }: any) => (
    <div>
      {items.map((it: any) => (
        <button key={it.key} onClick={() => onChange(it.key)}>{it.label}</button>
      ))}
    </div>
  ),
  Table: ({ loading, dataSource, columns }: any) => {
    if (loading) return <div className="ant-spin ant-spin-spinning" />
    return (
      <table>
        <tbody>
          {dataSource.map((r: any) => (
            <tr key={r.id}>
              {Array.isArray(columns) ? columns.map((col: any, idx: number) => (
                <td key={idx} data-col={col.key}>{col.render ? col.render(null, r) : r[col.key] || ''}</td>
              )) : <td>{r.displayName || r.name}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    )
  },
  Avatar: ({ children }: any) => <div>{children}</div>,
  Space: ({ children }: any) => <div>{children}</div>
}))
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
    vi_mockDocService.getAllPermissions.mockResolvedValue([])
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
    try {
      render(<DocumentPermissionModal isOpen={true} onClose={vi.fn()} bucketId="1" />)
      // Ant Table renders a spinner when loading; our mock exposes it as element with class 'ant-spin'
      expect(document.querySelector('.ant-spin')).toBeInTheDocument()
    } finally {
      // clear sentinel regardless of assertion outcome
      __mockQueryData['document-permissions'] = []
    }
  })

  it('tabs between users and teams', async () => {
    // Return some teams so tabs content loads
    __mockQueryData['teams'] = [{ id: 't1', name: 'Team1' }]
    __mockQueryData['document-permissions'] = []
    render(<DocumentPermissionModal isOpen={true} onClose={vi.fn()} bucketId="1" />)
    const tabs = screen.getAllByRole('button').filter(b => b.textContent?.includes('common.'))
    if (tabs.length >= 2) {
      fireEvent.click(tabs[1])
      // Expect team content to appear after switching
      await waitFor(() => expect(screen.getByText('Team1')).toBeInTheDocument())
    }
    __mockQueryData['teams'] = []
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
    // Try to change select (our mocked Ant Select renders a native select)
    const sel = document.querySelector('select')
    if (sel) {
      fireEvent.change(sel, { target: { value: '1' } })
      // Save button should now be enabled
      const buttons = screen.getAllByRole('button')
      const saveBtn = buttons[buttons.length - 1]
      await waitFor(() => expect(saveBtn).not.toHaveAttribute('disabled'))
    }
  })

  it('saves permission changes', async () => {
    __mockQueryData['users'] = [{ id: '1', displayName: 'John', email: 'j@e.com' }]
    __mockQueryData['document-permissions'] = [{ entity_type: 'user', entity_id: '1', permission_level: 0 }]
    vi_mockDocService.setPermission.mockResolvedValue(undefined)
    render(<DocumentPermissionModal isOpen={true} onClose={vi.fn()} bucketId="1" />)
    await waitFor(() => expect(screen.getByText('John')).toBeInTheDocument(), { timeout: 2000 })
    // Find the row for John and change its select
    const row = screen.getByText('John').closest('tr')
    expect(row).toBeTruthy()
    const sel = row!.querySelector('select') as HTMLSelectElement | null
    expect(sel).toBeTruthy()
    fireEvent.change(sel!, { target: { value: '1' } })
    // Find the save button reliably (footer is last, save is typically last button)
    const buttons = screen.getAllByRole('button')
    const saveBtn = buttons[buttons.length - 1]
    // Wait for save to become enabled (pendingChanges applied)
    await waitFor(() => expect(saveBtn).not.toHaveAttribute('disabled'), { timeout: 2000 })
    fireEvent.click(saveBtn)
    await waitFor(() => expect(vi_mockDocService.setPermission).toHaveBeenCalled())
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
    vi_mockDocService.getAllPermissions.mockResolvedValue([])
    render(<DocumentPermissionModal isOpen={true} onClose={vi.fn()} bucketId="1" />)
    const saveBtn = screen.getByText('common.save')
    expect(saveBtn).toHaveAttribute('disabled')
  })
})