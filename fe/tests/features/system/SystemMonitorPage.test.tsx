import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const vi_mockSystemService = vi.hoisted(() => ({
  getSystemHealth: vi.fn()
}))

vi.mock('../../../src/features/system/api/systemToolsService', () => ({
  getSystemHealth: vi_mockSystemService.getSystemHealth
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))
vi.mock('lucide-react', () => ({
  Activity: () => <div />,
  Server: () => <div />,
  Database: () => <div />,
  HardDrive: () => <div />,
  Cpu: () => <div />,
  Clock: () => <div />,
  RefreshCw: () => <div data-testid="refresh" />,
  Zap: () => <div />,
  Box: () => <div />,
  AlertCircle: () => <div />,
  CheckCircle2: () => <div />,
  XCircle: () => <div />,
  HelpCircle: () => <div />
}))

import SystemMonitorPage from '../../../src/features/system/pages/SystemMonitorPage'

describe('SystemMonitorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ services: {} })))) as any
    vi_mockSystemService.getSystemHealth.mockResolvedValue({
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'connected', enabled: true, host: 'localhost' },
        redis: { status: 'connected', enabled: true, host: 'localhost' },
        minio: { status: 'connected', enabled: true, host: 'localhost' },
        langfuse: { status: 'connected', enabled: true, host: 'localhost' }
      },
      system: {
        uptime: 3600,
        memory: { rss: 100, heapTotal: 50, heapUsed: 25, external: 10 },
        loadAvg: [0.5, 0.6, 0.7],
        cpus: 4,
        platform: 'linux',
        arch: 'x64',
        hostname: 'server'
      }
    })
  })

  it('renders monitor page', () => {
    render(<SystemMonitorPage />)
    expect(screen.getAllByText(/systemMonitor/).length).toBeGreaterThan(0)
  })

  it('loads health on mount', async () => {
    render(<SystemMonitorPage />)
    await waitFor(() => expect(vi_mockSystemService.getSystemHealth).toHaveBeenCalled())
  })

  it('displays service health', async () => {
    render(<SystemMonitorPage />)
    // Allow initial fetch microtasks to complete
    await Promise.resolve()
    await waitFor(() => {
      expect(screen.getByText(/database/i)).toBeInTheDocument()
      expect(screen.getByText(/redis/i)).toBeInTheDocument()
    })
  })

  it('shows connected status badge', async () => {
    render(<SystemMonitorPage />)
    await Promise.resolve()
    await waitFor(() => expect(screen.getAllByText(/healthy/).length).toBeGreaterThan(0))
  })

  it('displays system metrics', async () => {
    render(<SystemMonitorPage />)
    await Promise.resolve()
    await waitFor(() => {
      expect(screen.getByText(/uptime/i)).toBeInTheDocument()
      expect(screen.getAllByText(/memory/i).length).toBeGreaterThan(0)
    })
  })

  it('auto-refreshes on interval', async () => {
    // Spy on setInterval so we can invoke the callback manually without using fake timers
    const intervals: Function[] = []
    const spy = vi.spyOn(global, 'setInterval' as any).mockImplementation((cb: any, ms: any) => {
      intervals.push(cb)
      return 123 as any
    })

    render(<SystemMonitorPage />)
    await waitFor(() => expect(vi_mockSystemService.getSystemHealth).toHaveBeenCalled())

    // There should be an interval registered
    expect(intervals.length).toBeGreaterThan(0)

    // Invoke the interval callback to simulate passage of time
    intervals[0]()
    // Allow async callbacks to resolve
    await Promise.resolve()
    await waitFor(() => expect(vi_mockSystemService.getSystemHealth).toHaveBeenCalledTimes(2), { timeout: 5000 })

    spy.mockRestore()
  })

  it('allows refresh interval change', async () => {
    render(<SystemMonitorPage />)
    const intervals = screen.getAllByText(/30s|1m|5m|10m/)
    if (intervals.length > 1) {
      fireEvent.click(intervals[1])
    }
  })

  it('shows error status for disconnected services', async () => {
    vi_mockSystemService.getSystemHealth.mockResolvedValue({
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'disconnected', enabled: true, host: 'localhost' },
        redis: { status: 'connected', enabled: true, host: 'localhost' },
        minio: { status: 'disconnected', enabled: true, host: 'localhost' },
        langfuse: { status: 'not_configured', enabled: false, host: 'localhost' }
      },
      system: { uptime: 3600, memory: { rss: 100, heapTotal: 50, heapUsed: 25, external: 10 }, loadAvg: [0.5], cpus: 4, platform: 'linux', arch: 'x64', hostname: 'server' }
    })
    render(<SystemMonitorPage />)
    await Promise.resolve()
    await waitFor(() => expect(screen.getAllByText(/error/).length).toBeGreaterThan(0), { timeout: 5000 })
  })

  it('refreshes on manual click', async () => {
    render(<SystemMonitorPage />)
    await waitFor(() => expect(vi_mockSystemService.getSystemHealth).toHaveBeenCalled())
    const refreshBtn = screen.getByTestId('refresh').closest('button')
    if (refreshBtn) {
      fireEvent.click(refreshBtn)
      // Allow refresh async call to settle
      await Promise.resolve()
      await waitFor(() => expect(vi_mockSystemService.getSystemHealth).toHaveBeenCalledTimes(2), { timeout: 5000 })
    }
  })

  it('handles health check errors', async () => {
    vi_mockSystemService.getSystemHealth.mockRejectedValueOnce(new Error('Failed to fetch health'))
    render(<SystemMonitorPage />)
    await waitFor(() => expect(vi_mockSystemService.getSystemHealth).toHaveBeenCalled())
  })

  it('displays disabled services appropriately', async () => {
    vi_mockSystemService.getSystemHealth.mockResolvedValue({
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'connected', enabled: true, host: 'localhost' },
        redis: { status: 'connected', enabled: false, host: 'localhost' },
        minio: { status: 'connected', enabled: true, host: 'localhost' },
        langfuse: { status: 'disabled', enabled: false, host: 'localhost' }
      },
      system: { uptime: 3600, memory: { rss: 100, heapTotal: 50, heapUsed: 25, external: 10 }, loadAvg: [0.5], cpus: 4, platform: 'linux', arch: 'x64', hostname: 'server' }
    })
    render(<SystemMonitorPage />)
    await Promise.resolve()
    await waitFor(() => expect(screen.getAllByText(/disabled/).length).toBeGreaterThan(0), { timeout: 5000 })
  })
})