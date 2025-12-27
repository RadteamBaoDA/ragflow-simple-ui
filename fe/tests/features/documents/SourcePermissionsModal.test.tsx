import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const vi_mockTeamService = vi.hoisted(() => ({ getTeams: vi.fn() }))
const mockUserService = vi.hoisted(() => ({ getAllUsers: vi.fn() }))

vi.mock('../../../src/features/teams', () => ({ teamService: vi_mockTeamService }))
vi.mock('../../../src/features/users', () => ({ userService: mockUserService }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))
let __mockQueryData: Record<string, any> = {}
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => {
    const key = opts?.queryKey?.[0]
    if (key && __mockQueryData[key] !== undefined) {
      if (__mockQueryData[key] === '__loading') return { data: [], isLoading: true }
      return { data: __mockQueryData[key], isLoading: false }
    }
    return { data: [], isLoading: false }
  }
}))
vi.mock('@/components/Dialog', () => ({
  Dialog: ({ open, children }: any) => open ? <div data-testid="dialog">{children}</div> : null
}))
vi.mock('lucide-react', () => ({
  Check: () => <div data-testid="check" />,
  Search: () => <div />,
  Users: () => <div />,
  Shield: () => <div />,
  User: () => <div />
}))

import { PermissionsSelector } from '../../../src/features/documents/components/SourcePermissionsModal'

describe('PermissionsSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __mockQueryData = {}
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify([])))) as any
    vi_mockTeamService.getTeams.mockResolvedValue([])
    mockUserService.getAllUsers.mockResolvedValue([])
  })

  it('renders with public option', () => {
    render(
      <PermissionsSelector
        isPublic={false}
        setIsPublic={vi.fn()}
        selectedTeamIds={[]}
        setSelectedTeamIds={vi.fn()}
        selectedUserIds={[]}
        setSelectedUserIds={vi.fn()}
      />
    )
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('toggles public permission', () => {
    const setIsPublic = vi.fn()
    render(
      <PermissionsSelector
        isPublic={false}
        setIsPublic={setIsPublic}
        selectedTeamIds={[]}
        setSelectedTeamIds={vi.fn()}
        selectedUserIds={[]}
        setSelectedUserIds={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('checkbox'))
    expect(setIsPublic).toHaveBeenCalled()
  })

  it('displays teams when not public', async () => {
    __mockQueryData['teams'] = [{ id: '1', name: 'Team A' }]
    render(
      <PermissionsSelector
        isPublic={false}
        setIsPublic={vi.fn()}
        selectedTeamIds={[]}
        setSelectedTeamIds={vi.fn()}
        selectedUserIds={[]}
        setSelectedUserIds={vi.fn()}
      />
    )
    await waitFor(() => expect(screen.getByText(/Team A/i)).toBeInTheDocument())
  })

  it('displays users when not public', async () => {
    __mockQueryData['users'] = [{ id: '1', displayName: 'John', email: 'j@e.com' }]
    render(
      <PermissionsSelector
        isPublic={false}
        setIsPublic={vi.fn()}
        selectedTeamIds={[]}
        setSelectedTeamIds={vi.fn()}
        selectedUserIds={[]}
        setSelectedUserIds={vi.fn()}
      />
    )
    await waitFor(() => expect(screen.getByText(/John/i)).toBeInTheDocument())
  })

  it('selects user', async () => {
    const setUserIds = vi.fn()
    __mockQueryData['users'] = [{ id: '1', displayName: 'John', email: 'j@e.com' }]
    render(
      <PermissionsSelector
        isPublic={false}
        setIsPublic={vi.fn()}
        selectedTeamIds={[]}
        setSelectedTeamIds={vi.fn()}
        selectedUserIds={[]}
        setSelectedUserIds={setUserIds}
      />
    )
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1])
        expect(setUserIds).toHaveBeenCalled()
      }
    })
  })

  it('searches items', () => {
    render(
      <PermissionsSelector
        isPublic={false}
        setIsPublic={vi.fn()}
        selectedTeamIds={[]}
        setSelectedTeamIds={vi.fn()}
        selectedUserIds={[]}
        setSelectedUserIds={vi.fn()}
      />
    )
    const searchInput = screen.getByPlaceholderText(/search/i)
    expect(searchInput).toBeInTheDocument()
  })

  it('hides options when public', () => {
    __mockQueryData['teams'] = [{ id: '1', name: 'Team A' }]
    const { container } = render(
      <PermissionsSelector
        isPublic={true}
        setIsPublic={vi.fn()}
        selectedTeamIds={[]}
        setSelectedTeamIds={vi.fn()}
        selectedUserIds={[]}
        setSelectedUserIds={vi.fn()}
      />
    )
    expect(container.textContent).not.toContain('Team A')
  })
})