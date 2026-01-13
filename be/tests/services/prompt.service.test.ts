/**
 * @fileoverview Unit tests for PromptService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PromptService } from '../../src/services/prompt.service.js'

const mockModelFactory = vi.hoisted(() => ({
    prompt: {
        create: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        findActiveWithFeedbackCounts: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        getAllTags: vi.fn(),
        getAllSources: vi.fn(),
    },
    promptInteraction: {
        create: vi.fn(),
        getFeedbackCounts: vi.fn(),
        getInteractionsWithUser: vi.fn(),
    },
    knowledgeBaseSource: {
        getChatSourceNames: vi.fn(),
    },
}))

const mockAuditService = vi.hoisted(() => ({
    log: vi.fn(),
}))

vi.mock('../../src/models/factory.js', () => ({
    ModelFactory: mockModelFactory,
}))

vi.mock('../../src/services/audit.service.js', () => ({
    auditService: mockAuditService,
    AuditAction: {
        CREATE_PROMPT: 'create_prompt',
        UPDATE_PROMPT: 'update_prompt',
        DELETE_PROMPT: 'delete_prompt',
    },
    AuditResourceType: {
        PROMPT: 'prompt',
    },
}))

describe('PromptService', () => {
    let service: PromptService

    beforeEach(() => {
        vi.clearAllMocks()
        service = PromptService.getSharedInstance()
    })

    describe('getSharedInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = PromptService.getSharedInstance()
            const instance2 = PromptService.getSharedInstance()

            expect(instance1).toBe(instance2)
        })
    })

    describe('createPrompt', () => {
        it('should create prompt with provided data', async () => {
            const mockPrompt = {
                id: 'prompt-1',
                title: 'Test Prompt',
                content: 'Test content',
                tags: JSON.stringify(['test']),
                source: 'chat',
                is_active: true,
            }
            mockModelFactory.prompt.create.mockResolvedValueOnce(mockPrompt)

            const result = await service.createPrompt('user-1', {
                title: 'Test Prompt',
                content: 'Test content',
                tags: ['test'],
            })

            expect(result).toBeDefined()
            expect(mockModelFactory.prompt.create).toHaveBeenCalled()
        })

        it('should set default source to chat', async () => {
            const mockPrompt = {
                id: 'prompt-1',
                title: 'Test Prompt',
                source: 'chat',
            }
            mockModelFactory.prompt.create.mockResolvedValueOnce(mockPrompt)

            await service.createPrompt('user-1', { title: 'Test Prompt' })

            const call = mockModelFactory.prompt.create.mock.calls[0][0]
            expect(call).toMatchObject(
                expect.objectContaining({
                    source: 'chat',
                })
            )
        })

        it('should stringify tags if provided', async () => {
            const mockPrompt = {
                id: 'prompt-1',
                title: 'Test Prompt',
                tags: JSON.stringify(['tag1', 'tag2']),
            }
            mockModelFactory.prompt.create.mockResolvedValueOnce(mockPrompt)

            await service.createPrompt('user-1', {
                title: 'Test Prompt',
                tags: ['tag1', 'tag2'],
            })

            const call = mockModelFactory.prompt.create.mock.calls[0][0]
            expect(call.tags).toBe(JSON.stringify(['tag1', 'tag2']))
        })

        it('should set is_active to true by default', async () => {
            const mockPrompt = {
                id: 'prompt-1',
                title: 'Test Prompt',
                is_active: true,
            }
            mockModelFactory.prompt.create.mockResolvedValueOnce(mockPrompt)

            await service.createPrompt('user-1', { title: 'Test Prompt' })

            const call = mockModelFactory.prompt.create.mock.calls[0][0]
            expect(call.is_active).toBe(true)
        })

        it('should audit prompt creation with user context', async () => {
            const mockPrompt = { id: 'prompt-1', title: 'Test' }
            mockModelFactory.prompt.create.mockResolvedValueOnce(mockPrompt)
            const user = { id: 'user-1', email: 'user@test.com', ip: '192.168.1.1' }

            await service.createPrompt('user-1', { title: 'Test' }, user)

            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'create_prompt',
                    resourceType: 'prompt',
                    userId: 'user-1',
                    ipAddress: '192.168.1.1',
                })
            )
        })
    })

    describe('getPromptById', () => {
        it('should get prompt by id', async () => {
            const mockPrompt = {
                id: 'prompt-1',
                title: 'Test Prompt',
                tags: JSON.stringify(['test']),
            }
            mockModelFactory.prompt.findById.mockResolvedValueOnce(mockPrompt)

            const result = await service.getPromptById('prompt-1')

            expect(result).toBeDefined()
            expect(result.id).toBe('prompt-1')
            expect(mockModelFactory.prompt.findById).toHaveBeenCalledWith('prompt-1')
        })

        it('should throw error if prompt not found', async () => {
            mockModelFactory.prompt.findById.mockResolvedValueOnce(null)

            await expect(service.getPromptById('prompt-1')).rejects.toThrow('Prompt not found')
        })

        it('should parse tags from JSON', async () => {
            const mockPrompt = {
                id: 'prompt-1',
                title: 'Test',
                tags: JSON.stringify(['tag1', 'tag2']),
            }
            mockModelFactory.prompt.findById.mockResolvedValueOnce(mockPrompt)

            const result = await service.getPromptById('prompt-1')

            expect(Array.isArray(result.tags)).toBe(true)
        })
    })

    describe('getPrompts', () => {
        it('should get all active prompts with pagination', async () => {
            const mockResult = {
                data: [
                    { id: 'p1', title: 'Prompt 1', tags: JSON.stringify([]) },
                    { id: 'p2', title: 'Prompt 2', tags: JSON.stringify(['tag']) },
                ],
                total: 2,
            }
            mockModelFactory.prompt.findActiveWithFeedbackCounts.mockResolvedValueOnce(mockResult)

            const result = await service.getPrompts()

            expect(result.data).toHaveLength(2)
            expect(result.total).toBe(2)
            expect(mockModelFactory.prompt.findActiveWithFeedbackCounts).toHaveBeenCalled()
        })

        it('should return empty array if no prompts', async () => {
            mockModelFactory.prompt.findActiveWithFeedbackCounts.mockResolvedValueOnce({ data: [], total: 0 })

            const result = await service.getPrompts()

            expect(result.data).toEqual([])
            expect(result.total).toBe(0)
        })

        it('should apply search filters', async () => {
            const mockResult = { data: [], total: 0 }
            mockModelFactory.prompt.findActiveWithFeedbackCounts.mockResolvedValueOnce(mockResult)

            await service.getPrompts({ search: 'test', tag: 'tag1', limit: 10, offset: 0 })

            expect(mockModelFactory.prompt.findActiveWithFeedbackCounts).toHaveBeenCalledWith(
                expect.objectContaining({
                    search: 'test',
                    tag: 'tag1',
                    limit: 10,
                    offset: 0,
                })
            )
        })
    })

    describe('updatePrompt', () => {
        it('should update prompt with provided fields', async () => {
            const mockPrompt = {
                id: 'prompt-1',
                title: 'Updated Prompt',
                tags: JSON.stringify(['new-tag']),
            }
            mockModelFactory.prompt.update.mockResolvedValueOnce(mockPrompt)

            const result = await service.updatePrompt('prompt-1', { title: 'Updated Prompt' })

            expect(result).toBeDefined()
            expect(mockModelFactory.prompt.update).toHaveBeenCalled()
        })

        it('should audit prompt update', async () => {
            const mockPrompt = { id: 'prompt-1', title: 'Updated' }
            mockModelFactory.prompt.update.mockResolvedValueOnce(mockPrompt)
            const user = { id: 'user-1', email: 'user@test.com' }

            await service.updatePrompt('prompt-1', { title: 'Updated' }, user)

            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'update_prompt',
                    resourceId: 'prompt-1',
                })
            )
        })
    })

    describe('deletePrompt', () => {
        it('should soft delete prompt by setting is_active to false', async () => {
            const mockPrompt = { id: 'prompt-1', title: 'Test' }
            mockModelFactory.prompt.findById.mockResolvedValueOnce(mockPrompt)
            mockModelFactory.prompt.update.mockResolvedValueOnce(undefined)

            await service.deletePrompt('prompt-1')

            expect(mockModelFactory.prompt.update).toHaveBeenCalledWith(
                'prompt-1',
                expect.objectContaining({ is_active: false })
            )
        })

        it('should audit prompt deletion', async () => {
            const mockPrompt = { id: 'prompt-1', title: 'Test' }
            const user = { id: 'user-1', email: 'user@test.com' }
            mockModelFactory.prompt.findById.mockResolvedValueOnce(mockPrompt)
            mockModelFactory.prompt.update.mockResolvedValueOnce(undefined)

            await service.deletePrompt('prompt-1', user)

            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'delete_prompt',
                    resourceId: 'prompt-1',
                    userId: 'user-1',
                })
            )
        })

        it('should handle missing prompt gracefully', async () => {
            mockModelFactory.prompt.findById.mockResolvedValueOnce(null)
            mockModelFactory.prompt.update.mockResolvedValueOnce(undefined)

            await service.deletePrompt('non-existent')

            expect(mockModelFactory.prompt.update).toHaveBeenCalled()
        })
    })

    describe('addInteraction', () => {
        it('should create like interaction', async () => {
            const mockPrompt = { id: 'prompt-1', prompt: 'Test prompt content' }
            const mockInteraction = {
                id: 'interaction-1',
                user_id: 'user-1',
                prompt_id: 'prompt-1',
                interaction_type: 'like',
                prompt_snapshot: 'Test prompt content',
            }
            mockModelFactory.prompt.findById.mockResolvedValueOnce(mockPrompt)
            mockModelFactory.promptInteraction.create.mockResolvedValueOnce(mockInteraction)

            const result = await service.addInteraction('user-1', {
                prompt_id: 'prompt-1',
                interaction_type: 'like',
            })

            expect(result).toBeDefined()
            expect(mockModelFactory.promptInteraction.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt_id: 'prompt-1',
                    interaction_type: 'like',
                    user_id: 'user-1',
                })
            )
        })

        it('should create comment interaction with text', async () => {
            const mockPrompt = { id: 'prompt-1', prompt: 'Test prompt' }
            const mockInteraction = {
                id: 'interaction-2',
                user_id: 'user-1',
                prompt_id: 'prompt-1',
                interaction_type: 'comment',
                comment: 'Good prompt',
                prompt_snapshot: 'Test prompt',
            }
            mockModelFactory.prompt.findById.mockResolvedValueOnce(mockPrompt)
            mockModelFactory.promptInteraction.create.mockResolvedValueOnce(mockInteraction)

            const result = await service.addInteraction('user-1', {
                prompt_id: 'prompt-1',
                interaction_type: 'comment',
                comment: 'Good prompt',
            })

            expect(result).toBeDefined()
            expect(mockModelFactory.promptInteraction.create).toHaveBeenCalled()
        })

        it('should save prompt snapshot for interaction', async () => {
            const mockPrompt = { id: 'prompt-1', prompt: 'Snapshot content' }
            mockModelFactory.prompt.findById.mockResolvedValueOnce(mockPrompt)
            mockModelFactory.promptInteraction.create.mockResolvedValueOnce({})

            await service.addInteraction('user-1', {
                prompt_id: 'prompt-1',
                interaction_type: 'like',
            })

            expect(mockModelFactory.promptInteraction.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt_snapshot: 'Snapshot content',
                })
            )
        })

        it('should handle null prompt snapshot gracefully', async () => {
            mockModelFactory.prompt.findById.mockResolvedValueOnce(null)
            mockModelFactory.promptInteraction.create.mockResolvedValueOnce({})

            await service.addInteraction('user-1', {
                prompt_id: 'prompt-1',
                interaction_type: 'dislike',
            })

            expect(mockModelFactory.promptInteraction.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt_snapshot: null,
                })
            )
        })
    })

    describe('delegations and edge cases', () => {
        it('getFeedbackCounts delegates to model', async () => {
            mockModelFactory.promptInteraction.getFeedbackCounts.mockResolvedValueOnce({ like_count: 1, dislike_count: 2 })

            const res = await service.getFeedbackCounts('p7')
            expect(res).toEqual({ like_count: 1, dislike_count: 2 })
            expect(mockModelFactory.promptInteraction.getFeedbackCounts).toHaveBeenCalledWith('p7')
        })

        it('getInteractionsForPrompt delegates to model with date filters', async () => {
            const mockRows = [{ id: 'i3', user_email: 'e@test' }]
            mockModelFactory.promptInteraction.getInteractionsWithUser.mockResolvedValueOnce(mockRows)

            const rows = await service.getInteractionsForPrompt('p8', '2020-01-01', '2020-02-01')
            expect(rows).toEqual(mockRows)
            expect(mockModelFactory.promptInteraction.getInteractionsWithUser).toHaveBeenCalledWith('p8', '2020-01-01', '2020-02-01')
        })

        it('getAllTags/getAllSources/getChatSourceNames delegate to models', async () => {
            mockModelFactory.prompt.getAllTags.mockResolvedValueOnce(['t1'])
            mockModelFactory.prompt.getAllSources.mockResolvedValueOnce(['s1'])
            mockModelFactory.knowledgeBaseSource.getChatSourceNames.mockResolvedValueOnce(['cs1'])

            expect(await service.getAllTags()).toEqual(['t1'])
            expect(await service.getAllSources()).toEqual(['s1'])
            expect(await service.getChatSourceNames()).toEqual(['cs1'])
        })

        it('updatePrompt stringifies tags, sets updated_by and audits with previous prompt', async () => {
            const original = { id: 'p9', prompt: 'original before update' }
            mockModelFactory.prompt.findById.mockResolvedValueOnce(original)

            const updated = { id: 'p9', tags: JSON.stringify(['a']), prompt: 'updated' }
            mockModelFactory.prompt.update.mockResolvedValueOnce(updated)

            const user = { id: 'u9', email: 'u9@test.com' }
            const res = await service.updatePrompt('p9', { tags: ['a'] } as any, user as any)

            expect(mockModelFactory.prompt.update).toHaveBeenCalledWith('p9', expect.objectContaining({ tags: JSON.stringify(['a']), updated_by: 'u9' }))
            expect(res.tags).toEqual(['a'])
            expect((mockAuditService.log as any)).toHaveBeenCalledWith(expect.objectContaining({ action: 'update_prompt', resourceId: 'p9', userId: 'u9', details: expect.objectContaining({ previousPrompt: original.prompt.substring(0, 200) }) }))
        })

        it('updatePrompt throws when update returns null', async () => {
            mockModelFactory.prompt.findById.mockResolvedValueOnce({ id: 'p10', prompt: 'x' })
            mockModelFactory.prompt.update.mockResolvedValueOnce(null)

            await expect(service.updatePrompt('p10', { title: 'nope' } as any)).rejects.toThrow('Prompt not found')
        })

        it('normalizePrompt handles invalid JSON tags', () => {
            const svc = service as unknown as PromptService & { normalizePrompt: (p: any) => any }
            const bad = { id: 'bad', tags: 'not-json' } as any
            const out = svc.normalizePrompt(bad)
            expect(out.tags).toEqual([])
        })
    })
})
