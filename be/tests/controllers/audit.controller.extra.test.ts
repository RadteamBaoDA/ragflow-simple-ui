import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuditController } from '@/controllers/audit.controller.js'
import { auditService } from '@/services/audit.service.js'
import { log } from '@/services/logger.service.js'

const makeRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.send = vi.fn(() => res)
  res.header = vi.fn(() => res)
  res.attachment = vi.fn(() => res)
  return res
}

describe('AuditController extra branches', () => {
  const controller = new AuditController()
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('getLogs accepts array params via getStringParam', async () => {
    const res = makeRes()
    ;(auditService as any).getLogs = vi.fn().mockResolvedValueOnce({ logs: [], pagination: { total: 0 } })
    await controller.getLogs({ query: { userId: ['u1'] }, session: {} } as any, res)
    expect((auditService as any).getLogs).toHaveBeenCalledWith({ userId: 'u1' }, 50, 0)
  })

  it('exportLogs sends CSV with proper headers', async () => {
    const res = makeRes()
    ;(auditService as any).exportLogsToCsv = vi.fn().mockResolvedValueOnce('a,b,c')
    const req: any = { query: { userId: 'u1', startDate: '2020-01-01', endDate: '2020-01-02' } }
    await controller.exportLogs(req, res)
    expect(res.header).toHaveBeenCalledWith('Content-Type', 'text/csv')
    expect(res.attachment).toHaveBeenCalled()
    expect(res.send).toHaveBeenCalledWith('a,b,c')
  })

  it('exportLogs handles errors and logs', async () => {
    const res = makeRes()
    vi.spyOn(auditService as any, 'exportLogsToCsv').mockRejectedValueOnce(new Error('boom'))
    const spyErr = vi.spyOn(log, 'error').mockImplementation(() => {})
    await controller.exportLogs({ query: {} } as any, res)
    expect(spyErr).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })
})