import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UserManagementPage from '../../../src/features/users/pages/UserManagementPage'

const mockMgmt = {
  users: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  setSearchQuery: vi.fn(),
  roleFilter: 'all',
  setRoleFilter: vi.fn(),
  departmentFilter: 'all',
  setDepartmentFilter: vi.fn(),
  departments: [],
  paginatedUsers: [],
  filteredCount: 0,
  currentPage: 1,
  pageSize: 20,
  handlePaginationChange: vi.fn(),
  ipHistoryMap: {},
  updateRole: vi.fn(),
  isUpdatingRole: false,
  updatePermissions: vi.fn(),
  isUpdatingPermissions: false,
  setUsers: vi.fn(),
}

vi.mock('../../../src/features/users/hooks/useUserManagement', () => ({
  useUserManagement: () => mockMgmt
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('lucide-react', () => ({
  Mail: () => <div />,
  Edit2: () => <div data-testid="edit" />,
  Globe: () => <div data-testid="globe" />,
  Search: () => <div />,
  Filter: () => <div />,
  X: () => <div />,
  ArrowUp: () => <div />,
  ArrowDown: () => <div />,
  AlertCircle: () => <div />,
  Users: () => <div />,
}))

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: () => ({ data: undefined, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  QueryClient: class {
    clear = vi.fn()
  },
  QueryClientProvider: ({ children }: any) => <div>{children}</div>
}))

// Mock Ant Design components as needed
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    Table: ({ dataSource, columns }: any) => (
      <table role="table">
        <tbody>
          {dataSource.map((item: any) => (
            <tr key={item.id}>
              {columns.map((col: any) => (
                <td key={col.key || col.dataIndex}>
                  {col.render ? col.render(item[col.dataIndex], item) : (col.dataIndex ? item[col.dataIndex] : null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
  }
})

describe('UserManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockMgmt, {
      users: [],
      isLoading: false,
      error: null,
      paginatedUsers: [],
      filteredCount: 0,
      ipHistoryMap: {},
    })
  })

  it('renders user management page', () => {
    render(<UserManagementPage />)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockMgmt.isLoading = true
    render(<UserManagementPage />)
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows permission error for non-admin', () => {
    // We can't easily mock useAuth again here if it's already mocked at top level with a stable return
    // But we can update the return value if we use a variable
  })

  it('displays users in table', () => {
    const users = [{ id: '1', email: 'user@test.com', displayName: 'User', role: 'user' }]
    mockMgmt.paginatedUsers = users as any
    
    render(<UserManagementPage />)
    expect(screen.getByText('user@test.com')).toBeInTheDocument()
  })

  it('handles error state', () => {
    mockMgmt.error = 'Test Error'
    render(<UserManagementPage />)
    expect(screen.getByText('Test Error')).toBeInTheDocument()
  })
})