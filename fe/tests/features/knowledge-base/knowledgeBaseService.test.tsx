import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getKnowledgeBaseConfig, updateSystemConfig, getSources, addSource, updateSource, deleteSource } from '../../../src/features/knowledge-base/api/knowledgeBaseService'

describe('knowledgeBaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches config', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({
        defaultChatSourceId: '1',
        defaultSearchSourceId: '2',
        chatSources: [],
        searchSources: []
      })))
    )
    const result = await getKnowledgeBaseConfig()
    expect(result).toHaveProperty('defaultChatSourceId')
  })

  it('updates system config', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null)))
    await updateSystemConfig({ defaultChatSourceId: '1' })
    expect(global.fetch).toHaveBeenCalled()
  })

  it('gets sources with pagination', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({
        data: [{ id: '1', name: 'Test', url: 'http://localhost' }],
        total: 1,
        page: 1,
        limit: 10
      })))
    )
    const result = await getSources('chat', 1, 10)
    expect(result).toHaveProperty('data')
  })

  it('adds new source', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ id: '1', name: 'New', url: 'http://localhost' })))
    )
    const result = await addSource('chat', 'New', 'http://localhost')
    expect(result).toHaveProperty('id')
  })

  it('updates source', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null)))
    await updateSource('1', 'Updated', 'http://localhost')
    expect(global.fetch).toHaveBeenCalled()
  })

  it('deletes source', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null)))
    await deleteSource('1')
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/knowledge-base/sources/1'), expect.objectContaining({ method: 'DELETE' }))
  })

  it('includes credentials in requests', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({
        defaultChatSourceId: '1',
        defaultSearchSourceId: '2',
        chatSources: [],
        searchSources: []
      })))
    )
    await getKnowledgeBaseConfig()
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ credentials: 'include' }))
  })

  it('handles errors on config fetch', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 500 })))
    try {
      await getKnowledgeBaseConfig()
    } catch (e) {
      expect((e as Error).message).toContain('Failed')
    }
  })

  it('adds access control to source', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ id: '1', name: 'Test', access_control: { public: false, team_ids: [], user_ids: [] } })))
    )
    const result = await addSource('chat', 'Test', 'http://localhost', { public: false, team_ids: [], user_ids: [] })
    expect(result).toHaveProperty('access_control')
  })
})