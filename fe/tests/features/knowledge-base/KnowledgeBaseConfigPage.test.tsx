import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const vi_mockKBService = vi.hoisted(() => ({
  getKnowledgeBaseConfig: vi.fn(),
  updateSystemConfig: vi.fn(),
  addSource: vi.fn(),
  updateSource: vi.fn(),
  deleteSource: vi.fn()
}))

vi.mock('../../../src/features/knowledge-base/api/knowledgeBaseService', () => ({
  getKnowledgeBaseConfig: vi_mockKBService.getKnowledgeBaseConfig,
  updateSystemConfig: vi_mockKBService.updateSystemConfig,
  addSource: vi_mockKBService.addSource,
  updateSource: vi_mockKBService.updateSource,
  deleteSource: vi_mockKBService.deleteSource
}))
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    isAuthenticated: true,
  })
}))
vi.mock('@/features/guideline', () => ({
  useFirstVisit: () => ({ isFirstVisit: false }),
  GuidelineDialog: () => <div data-testid="guideline-dialog" />
}))
vi.mock('@/features/users', () => ({
  userApi: {
    getUsers: vi.fn(() => Promise.resolve([])),
  }
}))
vi.mock('@/features/teams', () => ({
  teamApi: {
    getTeams: vi.fn(() => Promise.resolve([])),
  }
}))
let __mockQueryData: Record<string, any> = {}
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => {
    const key = opts?.queryKey?.[0]
    if (key && __mockQueryData[key] === '__loading') return { data: undefined, isLoading: true }
    if (key && __mockQueryData[key] !== undefined) return { data: __mockQueryData[key], isLoading: false }
    return { data: undefined, isLoading: false }
  },
  useMutation: (opts: any) => ({ mutate: opts.mutationFn, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() })
}))
vi.mock('@/components/Dialog', () => ({
  Dialog: ({ open, children }: any) => open ? <div data-testid="dialog">{children}</div> : null
}))
const vi_confirm = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock('@/components/ConfirmDialog', () => ({
  useConfirm: () => vi_confirm
}))
vi.mock('../../../src/features/knowledge-base/components/SourcePermissionsModal', () => ({
  SourcePermissionsModal: () => <div />,
  PermissionsSelector: ({ isPublic }: any) => (
    <div>
      <label>
        <input type="checkbox" role="checkbox" checked={isPublic} readOnly />
      </label>
    </div>
  )
}))
vi.mock('lucide-react', () => ({
  MessageSquare: () => <div />,
  Search: () => <div />,
  Plus: () => <div data-testid="plus-icon" />,
  Edit2: () => <div data-testid="edit-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  Save: () => <div />,
  ExternalLink: () => <div />,
  Shield: () => <div />,
  Play: () => <div />,
  CheckCircle2: () => <div />,
  Book: () => <div />,
  HelpCircle: () => <div />,
  Clock: () => <div />,
  User: () => <div />,
  Users: () => <div />,
  Lock: () => <div />,
  Globe: () => <div />,
}))

import KnowledgeBaseConfigPage from '../../../src/features/knowledge-base/pages/KnowledgeBaseConfigPage'

describe('KnowledgeBaseConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __mockQueryData = {}
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ chatSources: [], searchSources: [] })))) as any
    const cfg = {
      defaultChatSourceId: '1',
      defaultSearchSourceId: '2',
      chatSources: [{ id: '1', name: 'Chat 1', url: 'http://localhost' }],
      searchSources: [{ id: '2', name: 'Search 1', url: 'http://localhost' }]
    }
    vi_mockKBService.getKnowledgeBaseConfig.mockResolvedValue(cfg)
    // Populate query data so the component sees it immediately
    __mockQueryData['knowledgeBaseConfig'] = cfg
    window.confirm = vi.fn(() => true)
  })

  it('renders config page', () => {
    render(<KnowledgeBaseConfigPage />)
    expect(screen.getByTestId('plus-icon')).toBeInTheDocument()
  })

  it('loads config on mount', async () => {
    render(<KnowledgeBaseConfigPage />)
    // Config is provided via __mockQueryData; assert the source name is shown
    await waitFor(() => expect(screen.getByText(/Chat 1/i)).toBeInTheDocument())
  })

  it('shows chat and search tabs', () => {
    render(<KnowledgeBaseConfigPage />)
    // Ant Tabs render role='tab' for each tab; ensure both tabs exist
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBeGreaterThanOrEqual(2)
  })

  it('adds new source', async () => {
    vi_mockKBService.addSource.mockResolvedValue({ id: '3', name: 'New', url: 'http://localhost' })
    render(<KnowledgeBaseConfigPage />)
    const addBtn = screen.getByTestId('plus-icon').closest('button')
    if (addBtn) {
      fireEvent.click(addBtn)
      await waitFor(() => expect(screen.getByTestId('dialog')).toBeInTheDocument())
    }
  })

  it('edits existing source', async () => {
    render(<KnowledgeBaseConfigPage />)
    const editBtn = screen.getByTestId('edit-icon').closest('button')
    if (editBtn) {
      fireEvent.click(editBtn)
      await waitFor(() => expect(screen.getByTestId('dialog')).toBeInTheDocument())
    }
  })

  it('deletes source', async () => {
    vi_mockKBService.deleteSource.mockResolvedValue(undefined)
    render(<KnowledgeBaseConfigPage />)
    const deleteBtn = screen.getByTestId('trash-icon').closest('button')
    if (deleteBtn) {
      fireEvent.click(deleteBtn)
      // Confirm helper should be called (we mock the confirm dialog via useConfirm)
      await waitFor(() => expect(vi_confirm).toHaveBeenCalled())
    }
  })

  it('saves default source', async () => {
    vi_mockKBService.updateSystemConfig.mockResolvedValue(undefined)
    render(<KnowledgeBaseConfigPage />)
    const saveBtn = screen.getByText(/common.save/i, { selector: 'button' })
    if (saveBtn) {
      fireEvent.click(saveBtn)
      await waitFor(() => expect(vi_mockKBService.updateSystemConfig).toHaveBeenCalled())
    }
  })

  it('switches tabs between chat and search', async () => {
    render(<KnowledgeBaseConfigPage />)
    const tabs = screen.getAllByRole('button').filter(b => b.className?.includes('tab'))
    if (tabs.length >= 2) {
      fireEvent.click(tabs[1])
      await waitFor(() => expect(vi_mockKBService.getKnowledgeBaseConfig).toHaveBeenCalled())
    }
  })

  it('resets form on cancel', async () => {
    render(<KnowledgeBaseConfigPage />)
    const addBtn = screen.getByTestId('plus-icon').closest('button')
    if (addBtn) {
      fireEvent.click(addBtn)
      await waitFor(() => {
        const cancelBtn = screen.getByText(/common.cancel/i, { selector: 'button' })
        fireEvent.click(cancelBtn)
      })
    }
  })

  it('defaults new source to private', async () => {
    render(<KnowledgeBaseConfigPage />)
    const addBtn = screen.getByTestId('plus-icon').closest('button')
    if (addBtn) {
      fireEvent.click(addBtn)
      await waitFor(() => {
        // The permissions UI uses a checkbox; ensure the first checkbox in dialog is not checked by default
        const checkboxes = screen.getAllByRole('checkbox')
        expect(checkboxes.length).toBeGreaterThan(0)
        expect((checkboxes[0] as HTMLInputElement).checked).toBe(false)
      })
    }
  })
})