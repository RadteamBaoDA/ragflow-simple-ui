
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExternalHistoryController } from './external-history.controller.js'
import { QueueService } from '@/services/queue.service.js'
import { Request, Response } from 'express'

// Mock queue service
vi.mock('@/services/queue.service.js', () => ({
    queueService: {
        addChatHistoryJob: vi.fn(),
        addSearchHistoryJob: vi.fn(),
    }
}))

// Mock logger
vi.mock('@/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        error: vi.fn()
    }
}))

describe('ExternalHistoryController', () => {
    let controller: ExternalHistoryController
    let req: Partial<Request>
    let res: Partial<Response>
    let mockQueueService: any

    beforeEach(async () => {
        // Import mocked module to get access to spies
        const queueServiceModule = await import('@/services/queue.service.js')
        mockQueueService = queueServiceModule.queueService

        controller = new ExternalHistoryController()

        req = {
            body: {}
        }
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        }

        vi.clearAllMocks()
    })

    describe('collectChatHistory', () => {
        it('should add job to queue and return 202 on valid input', async () => {
            req.body = {
                session_id: 'test-session',
                user_prompt: 'hello',
                llm_response: 'hi there',
                citations: []
            }

            await controller.collectChatHistory(req as Request, res as Response)

            expect(mockQueueService.addChatHistoryJob).toHaveBeenCalledWith({
                session_id: 'test-session',
                user_prompt: 'hello',
                llm_response: 'hi there',
                citations: []
            })
            expect(res.status).toHaveBeenCalledWith(202)
            expect(res.json).toHaveBeenCalledWith({ message: 'Chat history collection started' })
        })

        it('should return 400 if missing required fields', async () => {
            req.body = {
                // missing session_id
                user_prompt: 'hello'
            }

            await controller.collectChatHistory(req as Request, res as Response)

            expect(mockQueueService.addChatHistoryJob).not.toHaveBeenCalled()
            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' })
        })
    })

    describe('collectSearchHistory', () => {
        it('should add job to queue and return 202 on valid input', async () => {
            req.body = {
                search_input: 'test query',
                ai_summary: 'summary',
                file_results: ['file1.pdf']
            }

            await controller.collectSearchHistory(req as Request, res as Response)

            expect(mockQueueService.addSearchHistoryJob).toHaveBeenCalledWith({
                search_input: 'test query',
                ai_summary: 'summary',
                file_results: ['file1.pdf']
            })
            expect(res.status).toHaveBeenCalledWith(202)
            expect(res.json).toHaveBeenCalledWith({ message: 'Search history collection started' })
        })

        it('should return 400 if missing required fields', async () => {
            req.body = {
               // missing search_input
            }

            await controller.collectSearchHistory(req as Request, res as Response)

            expect(mockQueueService.addSearchHistoryJob).not.toHaveBeenCalled()
            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' })
        })
    })
})
