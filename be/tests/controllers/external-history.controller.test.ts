
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExternalHistoryController } from '../../src/modules/external/external-history.controller.js'
import { Request, Response } from 'express'

// Mock external history service
const mockExternalHistoryService = vi.hoisted(() => ({
    saveChatHistory: vi.fn(),
    saveSearchHistory: vi.fn(),
}))

// Mock logger
const mockLog = vi.hoisted(() => ({
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
}))

vi.mock('@/modules/external/external-history.service.js', () => ({
    externalHistoryService: mockExternalHistoryService,
}))

vi.mock('@/shared/services/logger.service.js', () => ({
    log: mockLog,
}))

describe('ExternalHistoryController', () => {
    let controller: ExternalHistoryController
    let req: Partial<Request>
    let res: Partial<Response>

    beforeEach(() => {
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
        it('should save history and return 201 on valid input', async () => {
            req.body = {
                session_id: 'test-session',
                user_prompt: 'hello',
                llm_response: 'hi there',
                citations: []
            }

            await controller.collectChatHistory(req as Request, res as Response)

            expect(mockExternalHistoryService.saveChatHistory).toHaveBeenCalledWith({
                session_id: 'test-session',
                share_id: undefined,
                user_email: undefined,
                user_prompt: 'hello',
                llm_response: 'hi there',
                citations: []
            })
            expect(res.status).toHaveBeenCalledWith(201)
            expect(res.json).toHaveBeenCalledWith({ message: 'Chat history saved successfully' })
        })

        it('should return 400 if missing required fields', async () => {
            req.body = {
                // missing session_id
                user_prompt: 'hello'
            }

            await controller.collectChatHistory(req as Request, res as Response)

            expect(mockExternalHistoryService.saveChatHistory).not.toHaveBeenCalled()
            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' })
        })
    })

    describe('collectSearchHistory', () => {
        it('should save history and return 201 on valid input', async () => {
            req.body = {
                search_input: 'test query',
                ai_summary: 'summary',
                file_results: ['file1.pdf']
            }

            await controller.collectSearchHistory(req as Request, res as Response)

            expect(mockExternalHistoryService.saveSearchHistory).toHaveBeenCalledWith({
                session_id: undefined,
                share_id: undefined,
                search_input: 'test query',
                user_email: undefined,
                ai_summary: 'summary',
                file_results: ['file1.pdf']
            })
            expect(res.status).toHaveBeenCalledWith(201)
            expect(res.json).toHaveBeenCalledWith({ message: 'Search history saved successfully' })
        })

        it('should return 400 if missing required fields', async () => {
            req.body = {
                // missing search_input
            }

            await controller.collectSearchHistory(req as Request, res as Response)

            expect(mockExternalHistoryService.saveSearchHistory).not.toHaveBeenCalled()
            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' })
        })
    })
})
