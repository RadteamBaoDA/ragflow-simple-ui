import { describe, it, expect, vi, beforeEach } from 'vitest'
import { broadcastMessageService } from '../../../src/features/broadcast/api/broadcastMessageService'

// Mock the environment variable
vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000')

describe('broadcastMessageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getActiveMessages fetches correctly', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([{ id: '1', message: 'Test' }])))
    )
    const result = await broadcastMessageService.getActiveMessages()
    expect(result).toEqual([{ id: '1', message: 'Test' }])
  })

  it('getAllMessages handles auth', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([{ id: '1', message: 'Test' }])))
    )
    const result = await broadcastMessageService.getAllMessages()
    expect(result).toEqual([{ id: '1', message: 'Test' }])
  })

  it('createMessage POSTs data', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ id: '1' })))
    )
    const data = { message: 'New', starts_at: '2025-01-01', ends_at: '2025-01-02', color: '#FF0000', font_color: '#FFFFFF', is_active: true, is_dismissible: true }
    const result = await broadcastMessageService.createMessage(data)
    expect(result).toEqual({ id: '1' })
  })

  it('updateMessage PUTs data', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ id: '1', message: 'Updated' })))
    )
    const result = await broadcastMessageService.updateMessage('1', { message: 'Updated' })
    expect(result).toEqual({ id: '1', message: 'Updated' })
  })

  it('deleteMessage sends DELETE', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(null))
    )
    await broadcastMessageService.deleteMessage('1')
    expect(global.fetch).toHaveBeenCalled()
  })

  it('dismissMessage records dismissal', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(null))
    )
    await broadcastMessageService.dismissMessage('1')
    expect(global.fetch).toHaveBeenCalled()
  })

  it('handles network errors', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))
    try {
      await broadcastMessageService.getActiveMessages()
    } catch (e) {
      expect((e as Error).message).toContain('Network')
    }
  })

  it('handles non-ok responses', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 500 }))
    )
    try {
      await broadcastMessageService.getActiveMessages()
    } catch (e) {
      expect((e as Error).message).toBeTruthy()
    }
  })
})