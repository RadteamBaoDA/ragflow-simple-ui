/**
 * @fileoverview Unit tests for TeamManagementPage.
 * Mocks useTeams and useTeamMembers hooks to test rendering and interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockTeamHook = vi.hoisted(() => ({
  teams: [] as any[],
  loading: false,
  searchTerm: '',
  handleSearch: vi.fn(),
  projectFilter: 'ALL',
  handleProjectFilter: vi.fn(),
  uniqueProjects: [] as string[],
  paginatedTeams: [] as any[],
  filteredCount: 0,
  currentPage: 1,
  pageSize: 10,
  handlePaginationChange: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  refresh: vi.fn(),
}))

const mockMemberHook = vi.hoisted(() => ({
  members: [] as any[],
  users: [] as any[],
  availableUsers: [] as any[],
  selectedUserIds: [] as string[],
  setSelectedUserIds: vi.fn(),
  addMemberError: null as string | null,
  loadMembers: vi.fn(),
  ensureUsersLoaded: vi.fn(),
  addMembers: vi.fn(),
  removeMember: vi.fn(),
  reset: vi.fn(),
}))

vi.mock('../../../src/features/teams/hooks/useTeams', () => ({
  useTeams: () => mockTeamHook,
}))

vi.mock('../../../src/features/teams/hooks/useTeamMembers', () => ({
  useTeamMembers: () => mockMemberHook,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  }),
  initReactI18next: { type: '3rdParty', init: () => {} }
}))

vi.mock('@/components/ConfirmDialog', () => ({ useConfirm: () => vi.fn(() => Promise.resolve(true)) }))
vi.mock('@/features/guideline', () => ({
  useFirstVisit: () => ({ isFirstVisit: false }),
  GuidelineDialog: () => <div data-testid="guideline-dialog" />
}))
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'u1@test.com', role: 'admin' },
    isAuthenticated: true,
  }),
}))
vi.mock('@/components/HeaderActions', () => ({
  useHeaderActions: () => vi.fn(),
  HeaderActions: ({ children }: any) => <div data-testid="header-actions-mock">{children}</div>,
  default: ({ children }: any) => <div data-testid="header-actions-mock">{children}</div>,
}))
vi.mock('@/components/Dialog', () => ({
  Dialog: ({ open, children }: any) => open ? <div data-testid="dialog">{children}<div className="footer"><button>{'common.cancel'}</button><button>{'common.save'}</button></div></div> : null
}))
vi.mock('../../../src/features/teams/components/TeamCard', () => ({
  TeamCard: ({ team, onEdit, onDelete, onManageMembers }: any) => (
    <div data-testid={`team-card-${team.id}`}>
      <span>{team.name}</span>
      <button data-testid={`edit-${team.id}`} onClick={() => onEdit(team)}>edit</button>
      <button data-testid={`delete-${team.id}`} onClick={() => onDelete(team.id)}>delete</button>
      <button data-testid={`members-${team.id}`} onClick={() => onManageMembers(team)}>members</button>
    </div>
  ),
}))
vi.mock('../../../src/features/teams/components/TeamFormDialog', () => ({
  TeamFormDialog: ({ open }: any) => open ? <div data-testid="team-form-dialog" /> : null,
}))
vi.mock('../../../src/features/teams/components/TeamMembersDialog', () => ({
  TeamMembersDialog: ({ open }: any) => open ? <div data-testid="team-members-dialog" /> : null,
}))
vi.mock('lucide-react', () => ({
  Plus: () => <div data-testid="plus" />,
  Search: () => <div />,
}))

import TeamManagementPage from '../../../src/features/teams/pages/TeamManagementPage'

describe('TeamManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the hooks to default state
    Object.assign(mockTeamHook, {
      teams: [],
      loading: false,
      paginatedTeams: [],
      filteredCount: 0,
      searchTerm: '',
      projectFilter: 'ALL',
      uniqueProjects: [],
    })
    Object.assign(mockMemberHook, {
      members: [],
      users: [],
      availableUsers: [],
      selectedUserIds: [],
      addMemberError: null,
    })
  })

  it('renders team management page with create button', () => {
    render(<TeamManagementPage />)
    expect(screen.getByTestId('plus')).toBeInTheDocument()
  })

  it('shows loading spinner', () => {
    mockTeamHook.loading = true
    render(<TeamManagementPage />)
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('displays teams list', () => {
    mockTeamHook.paginatedTeams = [
      { id: '1', name: 'Engineering', description: 'Eng team', created_at: '2025-01-01' }
    ]
    mockTeamHook.filteredCount = 1
    render(<TeamManagementPage />)
    expect(screen.getByText('Engineering')).toBeInTheDocument()
  })

  it('opens create dialog on button click', async () => {
    render(<TeamManagementPage />)
    const addBtn = screen.getByTestId('plus').closest('button')
    expect(addBtn).toBeTruthy()
    if (addBtn) {
      fireEvent.click(addBtn)
      await waitFor(() => expect(screen.getByTestId('team-form-dialog')).toBeInTheDocument())
    }
  })

  it('opens edit dialog when edit button is clicked', async () => {
    mockTeamHook.paginatedTeams = [
      { id: '1', name: 'Team', description: 'desc', created_at: '2025-01-01' }
    ]
    render(<TeamManagementPage />)
    fireEvent.click(screen.getByTestId('edit-1'))
    await waitFor(() => expect(screen.getByTestId('team-form-dialog')).toBeInTheDocument())
  })

  it('opens members dialog when members button is clicked', async () => {
    mockTeamHook.paginatedTeams = [
      { id: '1', name: 'Team', description: 'desc', created_at: '2025-01-01' }
    ]
    render(<TeamManagementPage />)
    fireEvent.click(screen.getByTestId('members-1'))
    
    await waitFor(() => expect(screen.getByTestId('team-members-dialog')).toBeInTheDocument())
    expect(mockMemberHook.loadMembers).toHaveBeenCalledWith('1')
    expect(mockMemberHook.ensureUsersLoaded).toHaveBeenCalled()
  })

  it('calls deleteTeam when delete button is clicked', () => {
    mockTeamHook.paginatedTeams = [
      { id: '1', name: 'Team', description: 'desc', created_at: '2025-01-01' }
    ]
    render(<TeamManagementPage />)
    fireEvent.click(screen.getByTestId('delete-1'))
    expect(mockTeamHook.deleteTeam).toHaveBeenCalledWith('1')
  })

  it('handles search input', () => {
    render(<TeamManagementPage />)
    const searchInput = screen.getByPlaceholderText('common.searchPlaceholder')
    fireEvent.change(searchInput, { target: { value: 'Engineering' } })
    expect(mockTeamHook.handleSearch).toHaveBeenCalledWith('Engineering')
  })
})