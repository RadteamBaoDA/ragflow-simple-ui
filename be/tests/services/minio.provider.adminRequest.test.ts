import { describe, it, expect, vi, beforeEach } from 'vitest'
// Mock http/https before importing provider so we can set request implementations
vi.mock('http', () => ({ request: vi.fn() }))
vi.mock('https', () => ({ request: vi.fn() }))
import * as http from 'http'
import * as https from 'https'
import { MinioStorageProvider } from '@/services/storage/providers/minio.provider.js'

// Helper to create a fake response stream
function makeRes(statusCode: number, body: string) {
  const res: any = new (require('stream').Readable)()
  res._read = () => {}
  res.statusCode = statusCode
  process.nextTick(() => {
    if (body) res.emit('data', Buffer.from(body))
    res.emit('end')
  })
  return res
}

describe('MinioStorageProvider adminRequest', () => {
  let provider: MinioStorageProvider
  beforeEach(() => {
    provider = new MinioStorageProvider({} as any)
    vi.restoreAllMocks()
  })

  it('parses JSON response on success', async () => {
    // stub http.request to call callback with res that emits JSON
    const reqMock: any = { on: vi.fn(), write: vi.fn(), end: vi.fn() }
    ;(http as any).request.mockImplementation((opts: any, cb2: any) => {
      cb2(makeRes(200, JSON.stringify({ ok: true })))
      return reqMock
    })

    const res = await (provider as any).adminRequest('GET', 'foo')
    expect(res).toEqual({ ok: true })
  })

  it('returns raw data when not JSON', async () => {
    const reqMock: any = { on: vi.fn(), write: vi.fn(), end: vi.fn() }
    ;(http as any).request.mockImplementation((opts: any, cb2: any) => {
      cb2(makeRes(200, 'plain text'))
      return reqMock
    })

    const res = await (provider as any).adminRequest('GET', 'foo')
    expect(res).toBe('plain text')
  })

  it('rejects on 4xx+ status', async () => {
    const reqMock: any = { on: vi.fn(), write: vi.fn(), end: vi.fn() }
    ;(http as any).request.mockImplementation((opts: any, cb2: any) => {
      cb2(makeRes(500, JSON.stringify({ error: 'boom' })))
      return reqMock
    })

    await expect((provider as any).adminRequest('POST', 'minio/admin/v3/something', {}, { a: 1 })).rejects.toThrow()
  })

  it('uses HTTPS module when useSSL true', async () => {
    const p = new MinioStorageProvider({} as any)
    ;(p as any).config.useSSL = true
    const reqMock: any = { on: vi.fn(), write: vi.fn(), end: vi.fn() }
    ;(https as any).request.mockImplementation((opts: any, cb2: any) => {
      cb2(makeRes(200, JSON.stringify({ ok: true })))
      return reqMock
    })
    const res = await (p as any).adminRequest('GET', 'foo')
    expect(res).toEqual({ ok: true })
  })
})