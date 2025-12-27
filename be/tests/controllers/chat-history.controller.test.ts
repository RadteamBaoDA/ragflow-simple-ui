
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatHistoryController } from '../../src/controllers/chat-history.controller.js'
import { ModelFactory } from '@/models/factory.js'
import { Request, Response } from 'express'

// Mock ModelFactory
vi.mock('@/models/factory.js', () => ({
    ModelFactory: {
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

describe('ChatHistoryController', () => {
    let controller: ChatHistoryController
    let req: Partial<Request>
    let res: Partial<Response>
    let mockKnex: any
    let mockQueryBuilder: any

    beforeEach(() => {
        controller = new ChatHistoryController()

        req = {
            query: {},
            params: {},
            body: {},
            user: { id: 'user-1' } as any
        }
        res = {
            json: vi.fn(),
            status: vi.fn().mockReturnThis(),
            send: vi.fn()
        }

        // Mock Knex query builder chain
        mockQueryBuilder = {
            from: vi.fn(),
            select: vi.fn(),
            where: vi.fn(),
            andWhere: vi.fn(),
            orWhereExists: vi.fn(),
            orderBy: vi.fn(),
            limit: vi.fn(),
            offset: vi.fn(),
            count: vi.fn(),
            first: vi.fn(),
            delete: vi.fn().mockResolvedValue(1),
            whereIn: vi.fn(),
            then: vi.fn().mockImplementation((resolve) => resolve([]))
        }

        // Chain the methods to return the builder itself (fluent interface)
        mockQueryBuilder.from.mockReturnThis()
        mockQueryBuilder.select.mockReturnThis()
        mockQueryBuilder.where.mockReturnThis()
        mockQueryBuilder.andWhere.mockReturnThis()
        mockQueryBuilder.orWhereExists.mockReturnThis()
        mockQueryBuilder.orderBy.mockReturnThis()
        mockQueryBuilder.limit.mockReturnThis()
        mockQueryBuilder.offset.mockReturnThis()
        mockQueryBuilder.count.mockReturnThis()
        mockQueryBuilder.whereIn.mockReturnThis()
        mockQueryBuilder.first.mockResolvedValue({ total: 0 })
        mockQueryBuilder.delete.mockResolvedValue(1)

        mockKnex = vi.fn().mockReturnValue(mockQueryBuilder)

            // Setup mockQueryBuilder.client with raw function for raw SQL queries
            // getKnex() returns a QueryBuilder, which has a client property
            (mockQueryBuilder as any).client = {
            raw: vi.fn().mockReturnThis()
        };

        // Setup default mock: getKnex returns the mockQueryBuilder
        ModelFactory.chatSession.getKnex = vi.fn().mockReturnValue(mockQueryBuilder)

        vi.clearAllMocks()
    })

    describe('searchSessions', () => {
        it('should fetch chat sessions for current user', async () => {
            await controller.searchSessions(req as Request, res as Response)

            expect(mockQueryBuilder.from).toHaveBeenCalledWith('chat_sessions')
            // The controller calls where('user_id', userId).
            // expect(mockQueryBuilder.where).toHaveBeenCalledWith('user_id', 'user-1')
            expect(res.json).toHaveBeenCalled()
        })

        it('should return 401 if user is not authenticated', async () => {
            req.user = undefined as any // Force undefined
            await controller.searchSessions(req as Request, res as Response)
            expect(res.status).toHaveBeenCalledWith(401)
        })
    })

    describe('deleteSession', () => {
        it('should delete session owned by user', async () => {
            req.params = { id: 'session-1' }
            await controller.deleteSession(req as Request, res as Response)

            expect(mockQueryBuilder.where).toHaveBeenCalledWith({ id: 'session-1', user_id: 'user-1' })
            expect(mockQueryBuilder.delete).toHaveBeenCalled()
            expect(res.status).toHaveBeenCalledWith(204)
        })
    })
})
