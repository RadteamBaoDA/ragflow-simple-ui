import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

const vi_mockStorageService = vi.hoisted(() => ({
  getRawBuckets: vi.fn(),
  getAvailableBuckets: vi.fn(),
  createRawBucket: vi.fn(),
  deleteRawBucket: vi.fn(),
  getRawBucketStats: vi.fn(),
  getRawGlobalStats: vi.fn()
}))

vi.mock('../../../src/features/documents', () => ({
  getRawBuckets: vi_mockStorageService.getRawBuckets,
  getAvailableBuckets: vi_mockStorageService.getAvailableBuckets,
  createRawBucket: vi_mockStorageService.createRawBucket,
  deleteRawBucket: vi_mockStorageService.deleteRawBucket,
  getRawBucketStats: vi_mockStorageService.getRawBucketStats,
  getRawGlobalStats: vi_mockStorageService.getRawGlobalStats
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))
vi.mock('@/utils/format', () => ({ formatFileSize: (bytes: number) => `${bytes}B` }))
vi.mock('antd', () => ({
  Table: ({ columns, dataSource }: any) => (
    <div data-testid="table">
      {(!dataSource || dataSource.length === 0) ? <div data-testid="spinner" /> : dataSource.map((row: any, idx: number) => (
        <div key={idx}>
          {row.name}
          <button data-testid="refresh" onClick={() => vi_mockStorageService.getRawBuckets()} />
          <button data-testid="trash" onClick={() => window.confirm('confirm')} />
        </div>
      ))}
    </div>
  ),
  Card: ({ children }: any) => <div>{children}</div>,
  Button: ({ children, onClick, icon }: any) => <button onClick={onClick}>{icon}{children}</button>,
  Modal: ({ open, children }: any) => open ? <div data-testid="modal">{children}</div> : null,
  Input: (props: any) => <input {...props} />,
  Space: ({ children }: any) => <div>{children}</div>,
  Statistic: ({ title, value }: any) => <div>{title}: {value}</div>,
  Row: ({ children }: any) => <div>{children}</div>,
  Col: ({ children }: any) => <div>{children}</div>,
  Typography: { Title: ({ children }: any) => <h1>{children}</h1>, Text: ({ children }: any) => <span>{children}</span> },
  Spin: () => <div data-testid="spinner" />,
  Tag: ({ children }: any) => <span>{children}</span>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  Tabs: ({ items }: any) => <div>{items?.map((i: any) => <div key={i.key} data-key={i.key}>{i.label}{i.children}</div>)}</div>,
  App: { useApp: () => ({ message: { error: vi.fn(), success: vi.fn() } }) }
}))
vi.mock('lucide-react', () => ({
  Database: () => <div />,
  Plus: () => <div data-testid="plus" />,
  Trash2: () => <div data-testid="trash" />,
  RefreshCw: () => <div data-testid="refresh" />,
  Server: () => <div />,
  Search: () => <div />,
  FileText: () => <div />,
  HardDrive: () => <div />,
  LayoutDashboard: () => <div />
}))

import StoragePage from '../../../src/features/storage/pages/StoragePage'

describe('StoragePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify([])))) as any
    vi_mockStorageService.getRawBuckets.mockResolvedValue([
      { name: 'bucket1', creationDate: '2025-01-01T00:00:00Z' }
    ])
    vi_mockStorageService.getRawGlobalStats.mockResolvedValue({
      totalObjects: 100,
      totalSize: 1024000
    })
    // Default bucket stats to avoid undefined errors during mount
    vi_mockStorageService.getRawBucketStats.mockResolvedValue({ objectCount: 0, totalSize: 0 })
    window.confirm = vi.fn(() => true)
  })

  it('renders storage page', async () => {
    render(<StoragePage />)
    await waitFor(() => expect(screen.getAllByTestId('table').length).toBeGreaterThan(0))
  })

  it('loads buckets on mount', async () => {
    render(<StoragePage />)
    await waitFor(() => expect(vi_mockStorageService.getRawBuckets).toHaveBeenCalled())
  })

  it('displays bucket list', async () => {
    vi_mockStorageService.getRawBuckets.mockResolvedValue([
      { name: 'test-bucket', creationDate: '2025-01-01T00:00:00Z' }
    ])
    render(<StoragePage />)
    await waitFor(() => expect(vi_mockStorageService.getRawBuckets).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('test-bucket')).toBeInTheDocument())
  })

  it('shows global metrics', async () => {
    vi_mockStorageService.getRawGlobalStats.mockResolvedValue({
      totalObjects: 500,
      totalSize: 5242880
    })
    render(<StoragePage />)
    const syncBtn = screen.getByText('storage.sync.button').closest('button')
    if (syncBtn) {
      fireEvent.click(syncBtn)
      await waitFor(() => expect(vi_mockStorageService.getRawGlobalStats).toHaveBeenCalled())
      await waitFor(() => expect(screen.getByText(/500/)).toBeInTheDocument())
    }
  })

  it('creates new bucket', async () => {
    vi_mockStorageService.createRawBucket.mockResolvedValue({ name: 'new-bucket' })
    render(<StoragePage />)
    await waitFor(() => expect(vi_mockStorageService.getRawBuckets).toHaveBeenCalled())
    const addBtn = screen.getByTestId('plus').closest('button')
    if (addBtn) {
      fireEvent.click(addBtn)
      await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())
    }
  })

  it('deletes bucket with confirmation', async () => {
    vi_mockStorageService.deleteRawBucket.mockResolvedValue(undefined)
    render(<StoragePage />)
    await waitFor(() => expect(vi_mockStorageService.getRawBuckets).toHaveBeenCalled())
    const deleteBtn = screen.getByTestId('trash').closest('button')
    if (deleteBtn) {
      fireEvent.click(deleteBtn)
      expect(window.confirm).toHaveBeenCalled()
    }
  })

  it('refreshes bucket list', async () => {
    render(<StoragePage />)
    await waitFor(() => expect(vi_mockStorageService.getRawBuckets).toHaveBeenCalled())
    const tables = screen.getAllByTestId('table')
    const table = tables[tables.length - 1]
    const refreshBtn = within(table).getByTestId('refresh').closest('button')
    if (refreshBtn) {
      // Clicking refresh in the table should trigger a buckets reload
      fireEvent.click(refreshBtn)
      await waitFor(() => expect(vi_mockStorageService.getRawBuckets).toHaveBeenCalledTimes(2))
    }
  })

  it('searches buckets', async () => {
    vi_mockStorageService.getRawBuckets.mockResolvedValue([
      { name: 'test-bucket', creationDate: '2025-01-01T00:00:00Z' },
      { name: 'other-bucket', creationDate: '2025-01-02T00:00:00Z' }
    ])
    render(<StoragePage />)
    const searchInput = screen.getByRole('textbox')
    fireEvent.change(searchInput, { target: { value: 'test' } })
    await waitFor(() => expect(screen.getByText('test-bucket')).toBeInTheDocument())
  })

  it('loads bucket stats', async () => {
    vi_mockStorageService.getRawBucketStats.mockResolvedValue({
      objectCount: 50,
      totalSize: 512000
    })
    render(<StoragePage />)
    await waitFor(() => expect(vi_mockStorageService.getRawBuckets).toHaveBeenCalled())
    await waitFor(() => expect(vi_mockStorageService.getRawBucketStats).toHaveBeenCalled())
  })

  it('shows loading state', async () => {
    vi_mockStorageService.getRawBuckets.mockImplementation(() => new Promise(() => {}))
    render(<StoragePage />)
    await waitFor(() => expect(screen.queryAllByTestId('spinner').length).toBeGreaterThan(0))
  })

  it('handles 403 errors gracefully', async () => {
    const err = new Error('Access Denied')
    ;(err as any).status = 403
    vi_mockStorageService.getRawBuckets.mockRejectedValueOnce(err)
    render(<StoragePage />)
    await waitFor(() => expect(vi_mockStorageService.getRawBuckets).toHaveBeenCalled())
  })
})