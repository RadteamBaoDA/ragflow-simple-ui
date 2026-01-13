import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as docService from '../../../src/features/documents/api/documentService'

function mockFetch(ok: boolean, body: any = {}, status = 200, statusText = 'OK') {
  return vi.fn().mockImplementation(() => Promise.resolve({
    ok,
    status,
    statusText,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }))
}

describe('documentService', () => {
  let originalFetch: any
  beforeEach(() => {
    originalFetch = globalThis.fetch
  })
  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  it('getBuckets returns buckets on success', async () => {
    globalThis.fetch = mockFetch(true, { buckets: [{ id: 'b1' }] })
    const buckets = await docService.getBuckets()
    expect(buckets).toEqual([{ id: 'b1' }])
  })

  it('getBuckets throws on failure', async () => {
    globalThis.fetch = mockFetch(false, { error: 'oops' }, 500, 'Internal')
    await expect(docService.getBuckets()).rejects.toThrow(/Failed to fetch buckets/)
  })

  it('createBucket throws when backend returns error json', async () => {
    globalThis.fetch = mockFetch(false, { error: 'bad' }, 400, 'Bad')
    await expect(docService.createBucket({ bucket_name: 'x', display_name: 'x' })).rejects.toThrow(/bad/)
  })

  it('listObjects throws DocumentServiceError with code when response not ok', async () => {
    globalThis.fetch = mockFetch(false, { message: 'nope', code: 'NOT_FOUND' }, 404)
    await expect(docService.listObjects('b', '')).rejects.toMatchObject({ name: 'DocumentServiceError', code: 'NOT_FOUND' })
  })

  it('getDownloadUrl returns download_url', async () => {
    globalThis.fetch = mockFetch(true, { download_url: 'http://x' })
    const url = await docService.getDownloadUrl('b', 'path', true)
    expect(url).toBe('http://x')
  })

  it('checkFilesExistence returns body on success', async () => {
    const body = { exists: ['a'] }
    globalThis.fetch = mockFetch(true, body)
    const res = await docService.checkFilesExistence('b', ['a'])
    expect(res).toEqual(body)
  })

  it('uploadFiles resolves on 200 with response json and supports progress callback', async () => {
    // fake XHR
    class FakeXHR {
      upload = { handlers: {}, addEventListener: (type: string, fn: any) => { this.upload.handlers[type] = fn } }
      status = 200
      responseText = JSON.stringify({ ok: true })
      listeners: any = {}
      addEventListener(type: string, fn: any) { this.listeners[type] = fn }
      open() {}
      send() {
        // simulate progress
        if (this.upload.handlers.progress) this.upload.handlers.progress({ lengthComputable: true, loaded: 50, total: 100 })
        // simulate load
        if (this.listeners.load) this.listeners.load()
      }
      set withCredentials(v) {}
    }
    const origXHR = (globalThis as any).XMLHttpRequest
    ;(globalThis as any).XMLHttpRequest = vi.fn().mockImplementation(() => new FakeXHR())

    const file = new File(['x'], 'f.txt', { type: 'text/plain' })
    const progresses: number[] = []
    const res = await docService.uploadFiles('b', [file], '', (p) => progresses.push(p))
    expect(res).toEqual({ ok: true })
    expect(progresses.length).toBeGreaterThan(0)

    ;(globalThis as any).XMLHttpRequest = origXHR
  })

  it('uploadFiles rejects on non-200 status', async () => {
    class FakeXHR2 {
      upload = { addEventListener: () => {} }
      status = 500
      responseText = 'err'
      listeners: any = {}
      addEventListener(type: string, fn: any) { this.listeners[type] = fn }
      open() {}
      send() { if (this.listeners.load) this.listeners.load() }
      set withCredentials(v) {}
    }
    const origXHR = (globalThis as any).XMLHttpRequest
    ;(globalThis as any).XMLHttpRequest = vi.fn().mockImplementation(() => new FakeXHR2())
    const file = new File(['x'], 'f.txt')
    await expect(docService.uploadFiles('b', [file])).rejects.toThrow(/Upload failed/)
    ;(globalThis as any).XMLHttpRequest = origXHR
  })

})
