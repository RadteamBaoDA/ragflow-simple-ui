/**
 * @fileoverview Unit tests for AdminHistoryService.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { adminHistoryService } from '../../src/modules/admin/admin-history.service.js';
import { ModelFactory } from '../../src/shared/models/factory.js';

describe('AdminHistoryService', () => {
    let mockQuery: any;
    let mockKnex: any;

    const createMockQuery = () => {
        const query: any = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockImplementation(function(arg: any){ if (typeof arg === 'function') { arg(this); return this } return this }),
            andWhere: vi.fn().mockReturnThis(),
            orWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            offset: vi.fn().mockReturnThis(),
            then: vi.fn((cb: any) => Promise.resolve([]).then(cb)),
            whereExists: vi.fn().mockReturnThis(),
            orWhereExists: vi.fn().mockImplementation(function(fn: any){ fn.call(this); return this }),
            whereRaw: vi.fn().mockReturnThis(),
            orWhereRaw: vi.fn().mockReturnThis(),
            client: {
                raw: vi.fn((sql) => sql) // Mock client.raw for getSystemChatHistory
            }
        };
        return query;
    };

    beforeEach(() => {
        mockQuery = createMockQuery();
        mockKnex = vi.fn(() => mockQuery) as any; // Mock knex instance behavior

        // Mock getter to return mockKnex which returns mockQuery
        // Actually getKnex() returns the QueryBuilder directly usually, 
        // effectively `knex(tableName)` returns a builder. 
        // Base model `getKnex()` returns `this.knex(this.tableName)`.

        // We need to mock getKnex() method on the models instance.
        vi.spyOn(ModelFactory.externalChatSession, 'getKnex').mockReturnValue(mockQuery);
        vi.spyOn(ModelFactory.externalSearchSession, 'getKnex').mockReturnValue(mockQuery);
        vi.spyOn(ModelFactory.externalChatMessage, 'getKnex').mockReturnValue(mockQuery); // For details
        vi.spyOn(ModelFactory.externalSearchRecord, 'getKnex').mockReturnValue(mockQuery); // For details
        vi.spyOn(ModelFactory.chatSession, 'getKnex').mockReturnValue(mockQuery); // For system chat
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getChatHistory', () => {
        const page = 1;
        const limit = 10;
        const email = 'user@test.com';

        it('should build correct query', async () => {
            await adminHistoryService.getChatHistory(page, limit, '', email, '', '');

            expect(mockQuery.select).toHaveBeenCalled();
            expect(mockQuery.from).toHaveBeenCalledWith('external_chat_sessions');
            expect(mockQuery.leftJoin).toHaveBeenCalledWith('knowledge_base_sources', 'external_chat_sessions.share_id', 'knowledge_base_sources.share_id');
            expect(mockQuery.orderBy).toHaveBeenCalledWith('external_chat_sessions.updated_at', 'desc');
            expect(mockQuery.limit).toHaveBeenCalledWith(limit);
        });

        it('should apply filters', async () => {
            await adminHistoryService.getChatHistory(page, limit, 'searchterm', email, '2023-01-01', '2023-01-31', 'source1');

            // Check basic filters. Complex search builder logic is harder to test without unwrapping the builder function
            // but we can check the simple where calls are present in the chain mock.
            // However main query logic wraps complex filters in a callback.

            // We can check startDate/endDate/sourceName are applied.
            // Note: The service implementation adds these simply to the chain.
            // `query = query.where('external_chat_sessions.updated_at', '>=', startDate);`

            // Since mockQuery methods return `this`, we can check calls on `mockQuery`.
            expect(mockQuery.where).toHaveBeenCalledWith('external_chat_sessions.updated_at', '>=', '2023-01-01');
            expect(mockQuery.where).toHaveBeenCalledWith('external_chat_sessions.updated_at', '<=', '2023-01-31 23:59:59');
            expect(mockQuery.where).toHaveBeenCalledWith('knowledge_base_sources.name', 'ilike', '%source1%');
        });
    });

    describe('getSearchHistory', () => {
        it('should build correct query', async () => {
            const page = 1;
            const limit = 10;
            const email = 'user@test.com';

            await adminHistoryService.getSearchHistory(page, limit, '', email, '', '');

            expect(mockQuery.select).toHaveBeenCalled();
            expect(mockQuery.from).toHaveBeenCalledWith('external_search_sessions');
            expect(mockQuery.leftJoin).toHaveBeenCalledWith('knowledge_base_sources', 'external_search_sessions.share_id', 'knowledge_base_sources.share_id');
            expect(mockQuery.orderBy).toHaveBeenCalledWith('external_search_sessions.updated_at', 'desc');
        });

        it('should apply search and orWhereExists when search provided', async () => {
            // make orWhereExists available on the mock
            mockQuery.orWhereExists = vi.fn().mockImplementation(function(fn: any) { fn.call(this); return this })

            await adminHistoryService.getSearchHistory(1, 10, 'term', '', '', '', '')
            // Ensure the subquery search predicates were applied on the sub builder
            expect(mockQuery.whereRaw).toHaveBeenCalled()
            expect(mockQuery.orWhereRaw).toHaveBeenCalled()
        })
    });

    describe('getSystemChatHistory', () => {
        it('should build correct query', async () => {
            const page = 1;
            const limit = 10;

            await adminHistoryService.getSystemChatHistory(page, limit, '');

            expect(mockQuery.from).toHaveBeenCalledWith('chat_sessions');
            expect(mockQuery.leftJoin).toHaveBeenCalledWith('users', 'chat_sessions.user_id', 'users.id');
            expect(mockQuery.select).toHaveBeenCalled();
            expect(mockQuery.orderBy).toHaveBeenCalledWith('chat_sessions.updated_at', 'desc');
        });

        it('should apply search filter and orWhereExists', async () => {
            mockQuery.orWhereExists = vi.fn().mockImplementation(function(fn: any) { fn.call(this); return this })
            await adminHistoryService.getSystemChatHistory(1, 10, 'hello')
            // check that message content filter applied to subquery
            expect(mockQuery.andWhere).toHaveBeenCalledWith('content', 'ilike', '%hello%')
        })
    });
});
