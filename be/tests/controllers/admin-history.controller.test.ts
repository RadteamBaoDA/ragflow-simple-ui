
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminHistoryController } from '../../src/controllers/admin-history.controller.js'
import { ModelFactory } from '@/models/factory.js'
import { Request, Response } from 'express'
import { log } from '@/services/logger.service.js'

// Mock adminHistoryService
const mockAdminHistoryService = vi.hoisted(() => ({
    getChatHistory: vi.fn(),
    getSearchHistory: vi.fn(),
    getSystemChatHistory: vi.fn(),
}))

vi.mock('@/services/admin-history.service.js', () => ({
    adminHistoryService: mockAdminHistoryService,
}))

// Mock ModelFactory
vi.mock('@/models/factory.js', () => ({
    ModelFactory: {
        externalChatHistory: {
            getKnex: vi.fn()
        },
        externalSearchHistory: {
            getKnex: vi.fn()
        },
        chatSession: {
            getKnex: vi.fn()
        }
    }
}))

// Mock logger
vi.mock('@/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        error: vi.fn()
    }
}))

// Mock db
vi.mock('@/db/knex.js', () => ({
    db: {
        raw: vi.fn((val) => val)
    }
}))

describe('AdminHistoryController', () => {
    let controller: AdminHistoryController
    let req: Partial<Request>
    let res: Partial<Response>
    let mockKnex: any
    let mockQueryBuilder: any

    beforeEach(() => {
        controller = new AdminHistoryController()

        req = {
            query: {}
        }
        res = {
            json: vi.fn(),
            status: vi.fn().mockReturnThis()
        }

        // Mock Knex query builder chain
        mockQueryBuilder = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            offset: vi.fn().mockReturnThis(),
            where: vi.fn().mockImplementation((arg) => {
                if (typeof arg === 'function') {
                    arg(mockQueryBuilder);
                }
                return mockQueryBuilder;
            }),
            orWhere: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockReturnThis(),
            orderByRaw: vi.fn().mockReturnThis(),
            then: vi.fn().mockImplementation((resolve) => resolve([])) // Allow await
        }

        mockKnex = vi.fn().mockReturnValue(mockQueryBuilder)

        // Setup default mocks
        mockKnex = vi.fn().mockReturnValue(mockQueryBuilder) // Create a fresh mockKnex

        ModelFactory.externalChatHistory.getKnex = vi.fn().mockReturnValue(mockQueryBuilder)
        ModelFactory.externalSearchHistory.getKnex = vi.fn().mockReturnValue(mockQueryBuilder)
        ModelFactory.chatSession.getKnex = vi.fn().mockReturnValue(mockQueryBuilder)

        vi.clearAllMocks()
    })

    describe('getChatHistory', () => {
        it('should fetch chat history with default pagination', async () => {
            mockAdminHistoryService.getChatHistory.mockResolvedValueOnce([])

            await controller.getChatHistory(req as Request, res as Response)

            expect(mockAdminHistoryService.getChatHistory).toHaveBeenCalledWith(1, 20, '', '', '', '', '')
            expect(res.json).toHaveBeenCalled()
        })

        it('should apply search filter if provided', async () => {
            mockAdminHistoryService.getChatHistory.mockResolvedValueOnce([])

            req.query = { q: 'test' }
            await controller.getChatHistory(req as Request, res as Response)

            expect(mockAdminHistoryService.getChatHistory).toHaveBeenCalledWith(1, 20, 'test', '', '', '', '')
        })
    })

    describe('getSearchHistory', () => {
        it('should fetch search history with default pagination', async () => {
            mockAdminHistoryService.getSearchHistory.mockResolvedValueOnce([])

            await controller.getSearchHistory(req as Request, res as Response)

            expect(mockAdminHistoryService.getSearchHistory).toHaveBeenCalledWith(1, 20, '', '', '', '', '')
            expect(res.json).toHaveBeenCalled()
        })

        it('should apply search filter if provided', async () => {
            mockAdminHistoryService.getSearchHistory.mockResolvedValueOnce([])

            req.query = { q: 'test' }
            await controller.getSearchHistory(req as Request, res as Response)

            expect(mockAdminHistoryService.getSearchHistory).toHaveBeenCalledWith(1, 20, 'test', '', '', '', '')
        })
    })

    describe('getSystemChatHistory', () => {
        beforeEach(() => {
            ModelFactory.chatSession.getKnex = vi.fn().mockReturnValue(mockQueryBuilder)

            // Mock subquery methods if needed, but the main query builder mock should handle it
            // since we return the same mock object.
            // However, leftJoin and other specific methods need to be mocked.
            mockQueryBuilder.leftJoin = vi.fn().mockReturnThis()
                // We need client.raw for the raw query part
                ; (mockQueryBuilder as any).client = {
                    raw: vi.fn().mockReturnThis()
                }
        })

        it('should fetch system chat history with default pagination', async () => {
            mockAdminHistoryService.getSystemChatHistory.mockResolvedValueOnce([])

            await controller.getSystemChatHistory(req as Request, res as Response)

            expect(mockAdminHistoryService.getSystemChatHistory).toHaveBeenCalledWith(1, 50, '')
            expect(res.json).toHaveBeenCalled()
        })

        it('should apply search filter if provided', async () => {
            mockAdminHistoryService.getSystemChatHistory.mockResolvedValueOnce([])

            req.query = { q: 'test' }
            await controller.getSystemChatHistory(req as Request, res as Response)

            expect(mockAdminHistoryService.getSystemChatHistory).toHaveBeenCalledWith(1, 50, 'test')
        })

        it('should return 500 and log error when service throws', async () => {
            const spyError = vi.spyOn(log, 'error')
            mockAdminHistoryService.getSystemChatHistory.mockRejectedValueOnce(new Error('boom'))

            await controller.getSystemChatHistory(req as Request, res as Response)

            expect(res.status).toHaveBeenCalledWith(500)
            expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
            expect(spyError).toHaveBeenCalled()
        })
    })

    describe('session details', () => {
        it('getChatSessionDetails validates input and returns 400 if missing', async () => {
            const reqNoId: any = { params: {} }
            const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any

            await controller.getChatSessionDetails(reqNoId, res)
            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ error: 'Session ID is required' })
        })

        it('getChatSessionDetails returns data and handles service errors', async () => {
            const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any
            mockAdminHistoryService.getChatSessionDetails = vi.fn().mockResolvedValueOnce(['m1'])

            await controller.getChatSessionDetails({ params: { sessionId: 's1' } } as any, res)
            expect(res.json).toHaveBeenCalledWith(['m1'])

            const spyError = vi.spyOn(log, 'error')
            mockAdminHistoryService.getChatSessionDetails = vi.fn().mockRejectedValueOnce(new Error('boom2'))
            await controller.getChatSessionDetails({ params: { sessionId: 's1' } } as any, res)
            expect(res.status).toHaveBeenCalledWith(500)
            expect(spyError).toHaveBeenCalled()
        })

        it('getSearchSessionDetails validates input and returns 400 if missing', async () => {
            const reqNoId: any = { params: {} }
            const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any

            await controller.getSearchSessionDetails(reqNoId, res)
            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ error: 'Session ID is required' })
        })

        it('getSearchSessionDetails returns data and handles service errors', async () => {
            const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any
            mockAdminHistoryService.getSearchSessionDetails = vi.fn().mockResolvedValueOnce(['r1'])

            await controller.getSearchSessionDetails({ params: { sessionId: 's2' } } as any, res)
            expect(res.json).toHaveBeenCalledWith(['r1'])

            const spyError = vi.spyOn(log, 'error')
            mockAdminHistoryService.getSearchSessionDetails = vi.fn().mockRejectedValueOnce(new Error('boom3'))
            await controller.getSearchSessionDetails({ params: { sessionId: 's2' } } as any, res)
            expect(res.status).toHaveBeenCalledWith(500)
            expect(spyError).toHaveBeenCalled()
        })
    })
})
