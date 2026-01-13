/**
 * @fileoverview Unit tests for promptService
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { promptService } from '../../../../src/features/prompts/api/promptService'
import { api } from '../../../../src/lib/api'

vi.mock('../../../../src/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('promptService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPrompts', () => {
    it('fetches prompts without params', async () => {
      const mockData = { data: [], total: 0 }
      vi.mocked(api.get).mockResolvedValueOnce(mockData)

      const result = await promptService.getPrompts()
      expect(result).toEqual(mockData)
      expect(api.get).toHaveBeenCalledWith('/api/prompts')
    })

    it('fetches prompts with search param', async () => {
      const mockData = { data: [], total: 0 }
      vi.mocked(api.get).mockResolvedValueOnce(mockData)

      await promptService.getPrompts({ search: 'test' })
      expect(api.get).toHaveBeenCalledWith('/api/prompts?search=test')
    })

    it('fetches prompts with multiple params', async () => {
      const mockData = { data: [], total: 0 }
      vi.mocked(api.get).mockResolvedValueOnce(mockData)

      await promptService.getPrompts({ search: 'test', tag: 'ai', limit: 10, offset: 5 })
      expect(api.get).toHaveBeenCalledWith('/api/prompts?search=test&tag=ai&limit=10&offset=5')
    })
  })

  describe('createPrompt', () => {
    it('creates a prompt', async () => {
      const dto = { title: 'Test', content: 'Test prompt', source: 'user' }
      const created = { id: '1', ...dto, created_at: '2024-01-01' }
      vi.mocked(api.post).mockResolvedValueOnce(created)

      const result = await promptService.createPrompt(dto)
      expect(result).toEqual(created)
      expect(api.post).toHaveBeenCalledWith('/api/prompts', dto)
    })
  })

  describe('updatePrompt', () => {
    it('updates a prompt', async () => {
      const dto = { title: 'Updated' }
      const updated = { id: '1', title: 'Updated' }
      vi.mocked(api.put).mockResolvedValueOnce(updated)

      const result = await promptService.updatePrompt('1', dto)
      expect(result).toEqual(updated)
      expect(api.put).toHaveBeenCalledWith('/api/prompts/1', dto)
    })
  })

  describe('deletePrompt', () => {
    it('deletes a prompt', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce(undefined)

      await promptService.deletePrompt('1')
      expect(api.delete).toHaveBeenCalledWith('/api/prompts/1')
    })
  })

  describe('addInteraction', () => {
    it('adds an interaction', async () => {
      const data = { prompt_id: '1', interaction_type: 'like' as const }
      const interaction = { id: '1', ...data, created_at: '2024-01-01' }
      vi.mocked(api.post).mockResolvedValueOnce(interaction)

      const result = await promptService.addInteraction(data)
      expect(result).toEqual(interaction)
      expect(api.post).toHaveBeenCalledWith('/api/prompts/interactions', data)
    })

    it('adds interaction with comment', async () => {
      const data = { prompt_id: '1', interaction_type: 'comment' as const, comment: 'Great!' }
      vi.mocked(api.post).mockResolvedValueOnce({ id: '1' })

      await promptService.addInteraction(data)
      expect(api.post).toHaveBeenCalledWith('/api/prompts/interactions', data)
    })
  })

  describe('getTags', () => {
    it('fetches tags', async () => {
      const tags = ['ai', 'ml', 'nlp']
      vi.mocked(api.get).mockResolvedValueOnce(tags)

      const result = await promptService.getTags()
      expect(result).toEqual(tags)
      expect(api.get).toHaveBeenCalledWith('/api/prompts/tags')
    })
  })

  describe('getSources', () => {
    it('fetches sources', async () => {
      const sources = ['user', 'system']
      vi.mocked(api.get).mockResolvedValueOnce(sources)

      const result = await promptService.getSources()
      expect(result).toEqual(sources)
      expect(api.get).toHaveBeenCalledWith('/api/prompts/sources')
    })
  })

  describe('getChatSources', () => {
    it('fetches chat sources', async () => {
      const sources = ['kb1', 'kb2']
      vi.mocked(api.get).mockResolvedValueOnce(sources)

      const result = await promptService.getChatSources()
      expect(result).toEqual(sources)
      expect(api.get).toHaveBeenCalledWith('/api/prompts/chat-sources')
    })
  })

  describe('getFeedbackCounts', () => {
    it('fetches feedback counts', async () => {
      const counts = { like_count: 5, dislike_count: 2 }
      vi.mocked(api.get).mockResolvedValueOnce(counts)

      const result = await promptService.getFeedbackCounts('prompt-1')
      expect(result).toEqual(counts)
      expect(api.get).toHaveBeenCalledWith('/api/prompts/prompt-1/feedback-counts')
    })
  })

  describe('getInteractions', () => {
    it('fetches interactions without date filter', async () => {
      const interactions = [{ id: '1', type: 'like' }]
      vi.mocked(api.get).mockResolvedValueOnce(interactions)

      const result = await promptService.getInteractions('prompt-1')
      expect(result).toEqual(interactions)
      expect(api.get).toHaveBeenCalledWith('/api/prompts/prompt-1/interactions')
    })

    it('fetches interactions with date filter', async () => {
      const interactions = [{ id: '1', type: 'like' }]
      vi.mocked(api.get).mockResolvedValueOnce(interactions)

      await promptService.getInteractions('prompt-1', '2024-01-01', '2024-01-31')
      expect(api.get).toHaveBeenCalledWith('/api/prompts/prompt-1/interactions?startDate=2024-01-01&endDate=2024-01-31')
    })
  })

  describe('getNewestTags', () => {
    it('fetches newest tags with default limit', async () => {
      const tags = [{ id: '1', name: 'AI', color: '#blue' }]
      vi.mocked(api.get).mockResolvedValueOnce(tags)

      const result = await promptService.getNewestTags()
      expect(result).toEqual(tags)
      expect(api.get).toHaveBeenCalledWith('/api/prompt-tags?limit=5')
    })

    it('fetches newest tags with custom limit', async () => {
      vi.mocked(api.get).mockResolvedValueOnce([])

      await promptService.getNewestTags(10)
      expect(api.get).toHaveBeenCalledWith('/api/prompt-tags?limit=10')
    })
  })

  describe('searchTags', () => {
    it('searches tags with query', async () => {
      const tags = [{ id: '1', name: 'AI', color: '#blue' }]
      vi.mocked(api.get).mockResolvedValueOnce(tags)

      const result = await promptService.searchTags('AI')
      expect(result).toEqual(tags)
      expect(api.get).toHaveBeenCalledWith('/api/prompt-tags/search?q=AI&limit=10')
    })

    it('fetches all tags when query is empty', async () => {
      vi.mocked(api.get).mockResolvedValueOnce([])

      await promptService.searchTags('  ')
      expect(api.get).toHaveBeenCalledWith('/api/prompt-tags?limit=10')
    })

    it('uses custom limit', async () => {
      vi.mocked(api.get).mockResolvedValueOnce([])

      await promptService.searchTags('test', 20)
      expect(api.get).toHaveBeenCalledWith('/api/prompt-tags/search?q=test&limit=20')
    })
  })

  describe('createTag', () => {
    it('creates a tag', async () => {
      const created = { id: '1', name: 'NewTag', color: '#red' }
      vi.mocked(api.post).mockResolvedValueOnce(created)

      const result = await promptService.createTag('NewTag', '#red')
      expect(result).toEqual(created)
      expect(api.post).toHaveBeenCalledWith('/api/prompt-tags', { name: 'NewTag', color: '#red' })
    })
  })

  describe('getTagsByIds', () => {
    it('fetches tags by IDs', async () => {
      const tags = [
        { id: '1', name: 'Tag1', color: '#blue' },
        { id: '2', name: 'Tag2', color: '#red' },
      ]
      vi.mocked(api.post).mockResolvedValueOnce(tags)

      const result = await promptService.getTagsByIds(['1', '2'])
      expect(result).toEqual(tags)
      expect(api.post).toHaveBeenCalledWith('/api/prompt-tags/by-ids', { ids: ['1', '2'] })
    })
  })

  describe('getPermissions', () => {
    it('fetches permissions', async () => {
      const perms = [{ id: '1', level: 2 }]
      vi.mocked(api.get).mockResolvedValueOnce(perms)

      const result = await promptService.getPermissions()
      expect(result).toEqual(perms)
      expect(api.get).toHaveBeenCalledWith('/api/prompts/permissions')
    })
  })

  describe('setPermission', () => {
    it('sets permission', async () => {
      vi.mocked(api.post).mockResolvedValueOnce(undefined)

      await promptService.setPermission('user', 'user-1', 2)
      expect(api.post).toHaveBeenCalledWith('/api/prompts/permissions', { entityType: 'user', entityId: 'user-1', level: 2 })
    })
  })

  describe('getMyPermission', () => {
    it('fetches my permission', async () => {
      const perm = { level: 3 }
      vi.mocked(api.get).mockResolvedValueOnce(perm)

      const result = await promptService.getMyPermission()
      expect(result).toEqual(perm)
      expect(api.get).toHaveBeenCalledWith('/api/prompts/permissions/my')
    })
  })
})
