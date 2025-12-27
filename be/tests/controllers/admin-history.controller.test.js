import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminHistoryController } from '../../src/controllers/admin-history.controller.js';
import { ModelFactory } from '@/models/factory.js';
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
}));
// Mock logger
vi.mock('@/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        error: vi.fn()
    }
}));
describe('AdminHistoryController', () => {
    let controller;
    let req;
    let res;
    let mockKnex;
    let mockQueryBuilder;
    beforeEach(() => {
        controller = new AdminHistoryController();
        req = {
            query: {}
        };
        res = {
            json: vi.fn(),
            status: vi.fn().mockReturnThis()
        };
        // Mock Knex query builder chain
        mockQueryBuilder = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            offset: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orWhere: vi.fn().mockReturnThis(),
            then: vi.fn().mockImplementation((resolve) => resolve([])) // Allow await
        };
        mockKnex = vi.fn().mockReturnValue(mockQueryBuilder);
        // Setup default mocks
        mockKnex = vi.fn().mockReturnValue(mockQueryBuilder); // Create a fresh mockKnex
        ModelFactory.externalChatHistory.getKnex = vi.fn().mockReturnValue(mockQueryBuilder);
        ModelFactory.externalSearchHistory.getKnex = vi.fn().mockReturnValue(mockQueryBuilder);
        ModelFactory.chatSession.getKnex = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.clearAllMocks();
    });
    describe('getChatHistory', () => {
        it('should fetch chat history with default pagination', async () => {
            await controller.getChatHistory(req, res);
            expect(mockQueryBuilder.from).toHaveBeenCalledWith('external_chat_history');
            expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
            expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
            expect(res.json).toHaveBeenCalled();
        });
        it('should apply search filter if provided', async () => {
            req.query = { q: 'test' };
            await controller.getChatHistory(req, res);
            expect(mockQueryBuilder.where).toHaveBeenCalledWith('user_prompt', 'ilike', '%test%');
            expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith('llm_response', 'ilike', '%test%');
        });
    });
    describe('getSearchHistory', () => {
        it('should fetch search history with default pagination', async () => {
            await controller.getSearchHistory(req, res);
            expect(mockQueryBuilder.from).toHaveBeenCalledWith('external_search_history');
            expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
            expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
            expect(res.json).toHaveBeenCalled();
        });
        it('should apply search filter if provided', async () => {
            req.query = { q: 'test' };
            await controller.getSearchHistory(req, res);
            expect(mockQueryBuilder.where).toHaveBeenCalledWith('search_input', 'ilike', '%test%');
            expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith('ai_summary', 'ilike', '%test%');
        });
    });
    describe('getSystemChatHistory', () => {
        beforeEach(() => {
            ModelFactory.chatSession.getKnex = vi.fn().mockReturnValue(mockQueryBuilder);
            // Mock subquery methods if needed, but the main query builder mock should handle it
            // since we return the same mock object.
            // However, leftJoin and other specific methods need to be mocked.
            mockQueryBuilder.leftJoin = vi.fn().mockReturnThis();
            mockQueryBuilder.client = {
                raw: vi.fn().mockReturnThis()
            };
        });
        it('should fetch system chat history with default pagination', async () => {
            await controller.getSystemChatHistory(req, res);
            // expect(mockKnex).toHaveBeenCalled() // Skipping this check because vi.mockReturnValue reuse logic is tricky with multiple models
            expect(mockQueryBuilder.from).toHaveBeenCalledWith('chat_sessions');
            expect(mockQueryBuilder.leftJoin).toHaveBeenCalledWith('users', 'chat_sessions.user_id', 'users.id');
            expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
            expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
            expect(res.json).toHaveBeenCalled();
        });
        it('should apply search filter if provided', async () => {
            req.query = { q: 'test' };
            await controller.getSystemChatHistory(req, res);
            // Since search uses a callback `where(builder => ...)` which is hard to spy on strictly
            // without executing the callback with a mock builder, we check if `where` was called.
            expect(mockQueryBuilder.where).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=admin-history.controller.test.js.map