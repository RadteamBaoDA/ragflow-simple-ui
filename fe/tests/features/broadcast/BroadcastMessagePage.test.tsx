import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const vi_mockBroadcastService = vi.hoisted(() => ({
  getAllMessages: vi.fn(),
  createMessage: vi.fn(),
  updateMessage: vi.fn(),
  deleteMessage: vi.fn()
}))
vi.mock('../../../src/features/broadcast/api/broadcastMessageService', () => ({ broadcastMessageService: vi_mockBroadcastService }))
vi.mock('react-i18next', () => ({ 
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} }
}))
let __mockQueryData: Record<string, any> = {}
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => {
    const key = opts?.queryKey?.[0]
    if (key && __mockQueryData[key] === '__loading') return { data: undefined, isLoading: true }
    if (key && __mockQueryData[key] !== undefined) return { data: __mockQueryData[key], isLoading: false }
    return { data: [], isLoading: false, error: null, refetch: vi.fn() }
  },
  useMutation: (opts: any) => ({
    mutate: opts.mutationFn,
    isPending: false,
    error: null
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn()
  })
}))
vi.mock('lucide-react', () => ({
  Plus: () => <div data-testid="plus-icon" />,
  Edit2: () => <div data-testid="edit-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  CheckCircle: () => <div data-testid="check-icon" />,
  XCircle: () => <div data-testid="x-circle-icon" />
}))
vi.mock('@/components/Dialog', () => ({
  Dialog: ({ open, children }: any) => open ? <div data-testid="dialog">{children}</div> : null
}))

import BroadcastMessagePage from '../../../src/features/broadcast/pages/BroadcastMessagePage'

describe('BroadcastMessagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __mockQueryData = {}
    // Provide a container for header actions where the add button will be portaled
    const header = document.createElement('div')
    header.id = 'header-actions'
    document.body.appendChild(header)
    vi_mockBroadcastService.getAllMessages.mockResolvedValue([])
    window.confirm = vi.fn(() => true)
    window.alert = vi.fn()
  })

  afterEach(() => {
    const header = document.getElementById('header-actions')
    if (header && header.parentNode) header.parentNode.removeChild(header)
  })

  it('renders page with add button', () => {
    render(<BroadcastMessagePage />)
    expect(screen.getByTestId('plus-icon')).toBeInTheDocument()
  })

  it('shows no data message', async () => {
    vi_mockBroadcastService.getAllMessages.mockResolvedValue([])
    render(<BroadcastMessagePage />)
    await waitFor(() => expect(screen.getByText('common.noData')).toBeInTheDocument())
  })

  it('renders messages table', async () => {
    const msg = { id: '1', message: 'Test', starts_at: '2025-01-01T00:00:00', ends_at: '2025-01-02T00:00:00', color: '#FF0000', font_color: '#FFFFFF', is_active: true, is_dismissible: true }
    __mockQueryData['broadcastMessages'] = [msg]
    render(<BroadcastMessagePage />)
    await waitFor(() => expect(screen.getByText('Test')).toBeInTheDocument())
  })

  it('opens dialog on add button click', async () => {
    render(<BroadcastMessagePage />)
    const addBtn = screen.getByTestId('plus-icon').closest('button')!
    fireEvent.click(addBtn)
    await waitFor(() => expect(screen.getByTestId('dialog')).toBeInTheDocument())
  })

  it('displays active badge for active messages', async () => {
    const msg = { id: '1', message: 'Test', starts_at: '2025-01-01T00:00:00', ends_at: '2025-01-02T00:00:00', color: '#FF0000', font_color: '#FFFFFF', is_active: true, is_dismissible: false }
    __mockQueryData['broadcastMessages'] = [msg]
    render(<BroadcastMessagePage />)
    await waitFor(() => expect(screen.getByTestId('check-icon')).toBeInTheDocument())
  })

  it('displays inactive badge for inactive messages', async () => {
    const msg = { id: '1', message: 'Test', starts_at: '2025-01-01T00:00:00', ends_at: '2025-01-02T00:00:00', color: '#FF0000', font_color: '#FFFFFF', is_active: false, is_dismissible: false }
    __mockQueryData['broadcastMessages'] = [msg]
    render(<BroadcastMessagePage />)
    await waitFor(() => expect(screen.getByTestId('x-circle-icon')).toBeInTheDocument())
  })

  it('opens edit dialog on edit click', async () => {
    const msg = { id: '1', message: 'Test', starts_at: '2025-01-01T00:00:00', ends_at: '2025-01-02T00:00:00', color: '#FF0000', font_color: '#FFFFFF', is_active: true, is_dismissible: false }
    __mockQueryData['broadcastMessages'] = [msg]
    render(<BroadcastMessagePage />)
    await waitFor(() => {
      const editBtn = screen.getByTestId('edit-icon')
      fireEvent.click(editBtn)
    })
    expect(screen.getByTestId('dialog')).toBeInTheDocument()
  })

  it('calls delete on trash click', async () => {
    const msg = { id: '1', message: 'Test', starts_at: '2025-01-01T00:00:00', ends_at: '2025-01-02T00:00:00', color: '#FF0000', font_color: '#FFFFFF', is_active: true, is_dismissible: false }
    __mockQueryData['broadcastMessages'] = [msg]
    vi_mockBroadcastService.deleteMessage.mockResolvedValue(undefined)
    render(<BroadcastMessagePage />)
    await waitFor(() => {
      const trashBtn = screen.getByTestId('trash-icon')
      fireEvent.click(trashBtn)
    })
    expect(vi_mockBroadcastService.deleteMessage).toHaveBeenCalledWith('1')
  })

  it('validates required fields on save', async () => {
    render(<BroadcastMessagePage />)
    const addBtn = screen.getByTestId('plus-icon').closest('button')!
    fireEvent.click(addBtn)
    await waitFor(() => expect(screen.getByTestId('dialog')).toBeInTheDocument())
  })
})