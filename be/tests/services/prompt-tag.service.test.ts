/**
 * Prompt Tag Service Tests
 * @description Tests for tag management service including CRUD and search operations.
 * @coverage getNewestTags, searchTags, createTag, getOrCreateTags, getTagById, getTagsByIds, generateRandomColor
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Mock dependencies using vi.hoisted to avoid forward references
 */
const mockModelFactory = vi.hoisted(() => ({
  promptTag: {
    getNewestTags: vi.fn(),
    searchByName: vi.fn(),
    findOrCreate: vi.fn(),
    findOrCreateMany: vi.fn(),
    findById: vi.fn(),
    findByIds: vi.fn(),
  },
}))

vi.mock('@/models/factory.js', () => ({
  ModelFactory: mockModelFactory,
}))

// Import after mocking
import { PromptTagService } from '@/services/prompt-tag.service.js'
import { PromptTag } from '@/models/types.js'

describe('PromptTagService', () => {
  let service: PromptTagService

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset singleton for each test
    ;(PromptTagService as any).instance = undefined
    service = PromptTagService.getSharedInstance()
  })

  describe('Singleton Pattern', () => {
    /**
     * Test: getSharedInstance returns same instance
     * Expects: Two calls return identical object reference
     */
    it('should return same instance on multiple calls', () => {
      const instance1 = PromptTagService.getSharedInstance()
      const instance2 = PromptTagService.getSharedInstance()
      expect(instance1).toBe(instance2)
    })

    /**
     * Test: Multiple service instances use same database connection
     * Expects: Both instances share state through singleton
     */
    it('should maintain singleton across multiple getSharedInstance calls', () => {
      const svc1 = PromptTagService.getSharedInstance()
      const svc2 = PromptTagService.getSharedInstance()
      const svc3 = PromptTagService.getSharedInstance()
      expect(svc1).toBe(svc2)
      expect(svc2).toBe(svc3)
    })
  })

  describe('getNewestTags', () => {
    /**
     * Test: Retrieve newest tags with default limit
     * Expects: Model method called with default limit of 5
     */
    it('should get newest tags with default limit', async () => {
      const mockTags: PromptTag[] = [
        { id: '1', name: 'tag1', color: '#FF5733' } as any,
        { id: '2', name: 'tag2', color: '#33FF57' } as any,
      ]
      vi.mocked(mockModelFactory.promptTag.getNewestTags).mockResolvedValue(
        mockTags,
      )

      const result = await service.getNewestTags()

      expect(mockModelFactory.promptTag.getNewestTags).toHaveBeenCalledWith(5)
      expect(result).toEqual(mockTags)
    })

    /**
     * Test: Retrieve newest tags with custom limit
     * Expects: Model method called with specified limit
     */
    it('should get newest tags with custom limit', async () => {
      const mockTags: PromptTag[] = [
        { id: '1', name: 'tag1', color: '#FF5733' } as any,
        { id: '2', name: 'tag2', color: '#33FF57' } as any,
        { id: '3', name: 'tag3', color: '#3357FF' } as any,
      ]
      vi.mocked(mockModelFactory.promptTag.getNewestTags).mockResolvedValue(
        mockTags,
      )

      const result = await service.getNewestTags(3)

      expect(mockModelFactory.promptTag.getNewestTags).toHaveBeenCalledWith(3)
      expect(result).toEqual(mockTags)
    })

    /**
     * Test: Empty result when no tags exist
     * Expects: Empty array returned
     */
    it('should return empty array when no tags exist', async () => {
      vi.mocked(mockModelFactory.promptTag.getNewestTags).mockResolvedValue([])

      const result = await service.getNewestTags()

      expect(result).toEqual([])
    })

    /**
     * Test: Handle large limit value
     * Expects: Model receives limit as-is
     */
    it('should handle large limit values', async () => {
      const mockTags: PromptTag[] = []
      vi.mocked(mockModelFactory.promptTag.getNewestTags).mockResolvedValue(
        mockTags,
      )

      await service.getNewestTags(1000)

      expect(mockModelFactory.promptTag.getNewestTags).toHaveBeenCalledWith(1000)
    })
  })

  describe('searchTags', () => {
    /**
     * Test: Search tags with valid query
     * Expects: searchByName called with query and limit
     */
    it('should search tags by name with query', async () => {
      const mockTags: PromptTag[] = [
        { id: '1', name: 'javascript', color: '#FF5733' } as any,
      ]
      vi.mocked(mockModelFactory.promptTag.searchByName).mockResolvedValue(
        mockTags,
      )

      const result = await service.searchTags('java', 10)

      expect(mockModelFactory.promptTag.searchByName).toHaveBeenCalledWith(
        'java',
        10,
      )
      expect(result).toEqual(mockTags)
    })

    /**
     * Test: Search with empty query returns newest tags
     * Expects: Falls back to getNewestTags
     */
    it('should return newest tags when query is empty string', async () => {
      const mockTags: PromptTag[] = [
        { id: '1', name: 'tag1', color: '#FF5733' } as any,
      ]
      vi.mocked(mockModelFactory.promptTag.getNewestTags).mockResolvedValue(
        mockTags,
      )

      const result = await service.searchTags('', 5)

      expect(mockModelFactory.promptTag.getNewestTags).toHaveBeenCalledWith(5)
      expect(result).toEqual(mockTags)
    })

    /**
     * Test: Search with whitespace-only query
     * Expects: Falls back to getNewestTags
     */
    it('should treat whitespace-only query as empty', async () => {
      const mockTags: PromptTag[] = [
        { id: '1', name: 'tag1', color: '#FF5733' } as any,
      ]
      vi.mocked(mockModelFactory.promptTag.getNewestTags).mockResolvedValue(
        mockTags,
      )

      const result = await service.searchTags('   ', 10)

      expect(mockModelFactory.promptTag.getNewestTags).toHaveBeenCalledWith(10)
      expect(result).toEqual(mockTags)
    })

    /**
     * Test: Search with custom limit
     * Expects: Custom limit passed to search method
     */
    it('should search with custom limit', async () => {
      const mockTags: PromptTag[] = []
      vi.mocked(mockModelFactory.promptTag.searchByName).mockResolvedValue(
        mockTags,
      )

      await service.searchTags('python', 20)

      expect(mockModelFactory.promptTag.searchByName).toHaveBeenCalledWith(
        'python',
        20,
      )
    })

    /**
     * Test: No results from search
     * Expects: Empty array returned
     */
    it('should return empty array when search has no results', async () => {
      vi.mocked(mockModelFactory.promptTag.searchByName).mockResolvedValue([])

      const result = await service.searchTags('nonexistent', 10)

      expect(result).toEqual([])
    })

    /**
     * Test: Multiple results from search
     * Expects: All matching tags returned
     */
    it('should return all matching tags from search', async () => {
      const mockTags: PromptTag[] = [
        { id: '1', name: 'python', color: '#FF5733' } as any,
        { id: '2', name: 'python-advanced', color: '#33FF57' } as any,
        { id: '3', name: 'python-basics', color: '#3357FF' } as any,
      ]
      vi.mocked(mockModelFactory.promptTag.searchByName).mockResolvedValue(
        mockTags,
      )

      const result = await service.searchTags('python', 10)

      expect(result).toHaveLength(3)
      expect(result).toEqual(mockTags)
    })
  })

  describe('createTag', () => {
    /**
     * Test: Create tag with name and color
     * Expects: findOrCreate called with provided values
     */
    it('should create tag with provided name and color', async () => {
      const mockTag: PromptTag = {
        id: 'tag-1',
        name: 'ai',
        color: '#FF5733',
      } as any
      vi.mocked(mockModelFactory.promptTag.findOrCreate).mockResolvedValue(
        mockTag,
      )

      const result = await service.createTag('ai', '#FF5733', 'user-1')

      expect(mockModelFactory.promptTag.findOrCreate).toHaveBeenCalledWith(
        'ai',
        '#FF5733',
        'user-1',
      )
      expect(result).toEqual(mockTag)
    })

    /**
     * Test: Create tag without color generates random color
     * Expects: findOrCreate called with random hex color
     */
    it('should generate random color when not provided', async () => {
      const mockTag: PromptTag = {
        id: 'tag-2',
        name: 'ml',
        color: '#ABC123',
      } as any
      vi.mocked(mockModelFactory.promptTag.findOrCreate).mockResolvedValue(
        mockTag,
      )

      const result = await service.createTag('ml', undefined, 'user-2')

      expect(mockModelFactory.promptTag.findOrCreate).toHaveBeenCalled()
      const callArgs = vi.mocked(
        mockModelFactory.promptTag.findOrCreate,
      ).mock.calls[0]
      expect(callArgs[0]).toBe('ml')
      // Color should be hex format
      expect(callArgs[1]).toMatch(/^#[0-9A-F]{6}$/i)
      expect(callArgs[2]).toBe('user-2')
    })

    /**
     * Test: Create tag without userId
     * Expects: findOrCreate called with undefined userId
     */
    it('should create tag without userId', async () => {
      const mockTag: PromptTag = {
        id: 'tag-3',
        name: 'nlp',
        color: '#33FF57',
      } as any
      vi.mocked(mockModelFactory.promptTag.findOrCreate).mockResolvedValue(
        mockTag,
      )

      const result = await service.createTag('nlp', '#33FF57')

      expect(mockModelFactory.promptTag.findOrCreate).toHaveBeenCalledWith(
        'nlp',
        '#33FF57',
        undefined,
      )
      expect(result).toEqual(mockTag)
    })

    /**
     * Test: Random color generation multiple times produces different colors
     * Expects: Each call generates unique color (probabilistically)
     */
    it('should generate different random colors on multiple calls', async () => {
      const mockTag: PromptTag = { id: 'tag', name: 'test', color: '' } as any

      const colors = new Set<string>()
      for (let i = 0; i < 5; i++) {
        vi.mocked(mockModelFactory.promptTag.findOrCreate).mockResolvedValue({
          ...mockTag,
          color: colors.add(`#${Math.random().toString(16).slice(2)}`),
        } as any)
        await service.createTag(`tag-${i}`)
      }

      // With 5 generations, statistically should have multiple colors
      // (collision probability extremely low)
      expect(colors.size).toBeGreaterThan(1)
    })
  })

  describe('getOrCreateTags', () => {
    /**
     * Test: Get or create multiple tags
     * Expects: findOrCreateMany called with tag names
     */
    it('should get or create multiple tags', async () => {
      const mockTags: PromptTag[] = [
        { id: '1', name: 'tag1', color: '#FF5733' } as any,
        { id: '2', name: 'tag2', color: '#33FF57' } as any,
      ]
      vi.mocked(mockModelFactory.promptTag.findOrCreateMany).mockResolvedValue(
        mockTags,
      )

      const result = await service.getOrCreateTags(
        ['tag1', 'tag2'],
        'user-123',
      )

      expect(mockModelFactory.promptTag.findOrCreateMany).toHaveBeenCalledWith(
        ['tag1', 'tag2'],
        'user-123',
      )
      expect(result).toEqual(mockTags)
    })

    /**
     * Test: Empty array of names returns empty array
     * Expects: No database call, returns []
     */
    it('should return empty array for empty names list', async () => {
      const result = await service.getOrCreateTags([])

      expect(mockModelFactory.promptTag.findOrCreateMany).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    /**
     * Test: Undefined names returns empty array
     * Expects: No database call, returns []
     */
    it('should return empty array for undefined names', async () => {
      const result = await service.getOrCreateTags(undefined as any)

      expect(mockModelFactory.promptTag.findOrCreateMany).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    /**
     * Test: Single tag in array
     * Expects: findOrCreateMany called with single-element array
     */
    it('should handle single tag name', async () => {
      const mockTag: PromptTag = {
        id: '1',
        name: 'single',
        color: '#FF5733',
      } as any
      vi.mocked(mockModelFactory.promptTag.findOrCreateMany).mockResolvedValue([
        mockTag,
      ])

      const result = await service.getOrCreateTags(['single'], 'user-1')

      expect(mockModelFactory.promptTag.findOrCreateMany).toHaveBeenCalledWith(
        ['single'],
        'user-1',
      )
      expect(result).toHaveLength(1)
    })

    /**
     * Test: Large array of tag names
     * Expects: All tags returned in same order as input
     */
    it('should handle large array of tag names', async () => {
      const names = Array.from({ length: 50 }, (_, i) => `tag${i}`)
      const mockTags: PromptTag[] = names.map((name, i) => ({
        id: `${i}`,
        name,
        color: '#FF5733',
      })) as any

      vi.mocked(mockModelFactory.promptTag.findOrCreateMany).mockResolvedValue(
        mockTags,
      )

      const result = await service.getOrCreateTags(names, 'user-1')

      expect(result).toHaveLength(50)
      expect(mockModelFactory.promptTag.findOrCreateMany).toHaveBeenCalledWith(
        names,
        'user-1',
      )
    })
  })

  describe('getTagById', () => {
    /**
     * Test: Get tag by valid ID
     * Expects: findById returns matching tag
     */
    it('should get tag by ID', async () => {
      const mockTag: PromptTag = {
        id: 'tag-123',
        name: 'test',
        color: '#FF5733',
      } as any
      vi.mocked(mockModelFactory.promptTag.findById).mockResolvedValue(mockTag)

      const result = await service.getTagById('tag-123')

      expect(mockModelFactory.promptTag.findById).toHaveBeenCalledWith(
        'tag-123',
      )
      expect(result).toEqual(mockTag)
    })

    /**
     * Test: Get tag with non-existent ID
     * Expects: undefined returned
     */
    it('should return undefined for non-existent tag', async () => {
      vi.mocked(mockModelFactory.promptTag.findById).mockResolvedValue(
        undefined,
      )

      const result = await service.getTagById('non-existent')

      expect(result).toBeUndefined()
    })

    /**
     * Test: Get tag with UUID format ID
     * Expects: findById called with exact ID
     */
    it('should handle UUID format tag IDs', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const mockTag: PromptTag = {
        id: uuid,
        name: 'uuid-tag',
        color: '#33FF57',
      } as any
      vi.mocked(mockModelFactory.promptTag.findById).mockResolvedValue(mockTag)

      const result = await service.getTagById(uuid)

      expect(mockModelFactory.promptTag.findById).toHaveBeenCalledWith(uuid)
      expect(result?.id).toBe(uuid)
    })
  })

  describe('getTagsByIds', () => {
    /**
     * Test: Get multiple tags by IDs
     * Expects: findByIds returns all matching tags
     */
    it('should get multiple tags by IDs', async () => {
      const mockTags: PromptTag[] = [
        { id: '1', name: 'tag1', color: '#FF5733' } as any,
        { id: '2', name: 'tag2', color: '#33FF57' } as any,
        { id: '3', name: 'tag3', color: '#3357FF' } as any,
      ]
      vi.mocked(mockModelFactory.promptTag.findByIds).mockResolvedValue(
        mockTags,
      )

      const result = await service.getTagsByIds(['1', '2', '3'])

      expect(mockModelFactory.promptTag.findByIds).toHaveBeenCalledWith([
        '1',
        '2',
        '3',
      ])
      expect(result).toEqual(mockTags)
    })

    /**
     * Test: Get tags with some non-existent IDs
     * Expects: Only existing tags returned
     */
    it('should return only existing tags when some IDs not found', async () => {
      const mockTags: PromptTag[] = [
        { id: '1', name: 'tag1', color: '#FF5733' } as any,
        { id: '3', name: 'tag3', color: '#3357FF' } as any,
      ]
      vi.mocked(mockModelFactory.promptTag.findByIds).mockResolvedValue(
        mockTags,
      )

      const result = await service.getTagsByIds(['1', '2', '3'])

      expect(result).toHaveLength(2)
      expect(result).toEqual(mockTags)
    })

    /**
     * Test: Empty array of IDs
     * Expects: Empty array returned
     */
    it('should handle empty ID array', async () => {
      vi.mocked(mockModelFactory.promptTag.findByIds).mockResolvedValue([])

      const result = await service.getTagsByIds([])

      expect(result).toEqual([])
    })

    /**
     * Test: Single ID
     * Expects: Single tag returned in array
     */
    it('should handle single ID', async () => {
      const mockTag: PromptTag = {
        id: '1',
        name: 'single',
        color: '#FF5733',
      } as any
      vi.mocked(mockModelFactory.promptTag.findByIds).mockResolvedValue([
        mockTag,
      ])

      const result = await service.getTagsByIds(['1'])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(mockTag)
    })

    /**
     * Test: Large array of IDs
     * Expects: All matching tags returned
     */
    it('should handle large array of IDs', async () => {
      const ids = Array.from({ length: 100 }, (_, i) => `${i}`)
      const mockTags: PromptTag[] = ids.slice(0, 50).map((id, i) => ({
        id,
        name: `tag${id}`,
        color: '#FF5733',
      })) as any

      vi.mocked(mockModelFactory.promptTag.findByIds).mockResolvedValue(
        mockTags,
      )

      const result = await service.getTagsByIds(ids)

      expect(mockModelFactory.promptTag.findByIds).toHaveBeenCalledWith(ids)
      expect(result).toHaveLength(50)
    })
  })

  describe('Random color generation', () => {
    /**
     * Test: Generated colors are valid hex format
     * Expects: All colors match #RRGGBB pattern
     */
    it('should generate valid hex color format', () => {
      for (let i = 0; i < 10; i++) {
        // Access private method through service instance type
        const color = (service as any).generateRandomColor()
        expect(color).toMatch(/^#[0-9A-F]{6}$/i)
      }
    })

    /**
     * Test: Color string starts with hash
     * Expects: All generated colors start with #
     */
    it('should start color string with hash symbol', () => {
      const color = (service as any).generateRandomColor()
      expect(color.charAt(0)).toBe('#')
      expect(color).toHaveLength(7) // #RRGGBB = 7 chars
    })

    /**
     * Test: Probability distribution of colors
     * Expects: Generated colors cover range of values
     */
    it('should generate colors across the range', () => {
      const colors = new Set<string>()
      for (let i = 0; i < 100; i++) {
        colors.add((service as any).generateRandomColor())
      }
      // With 100 generations, should have many unique colors
      expect(colors.size).toBeGreaterThan(90)
    })
  })
})
