/**
 * @fileoverview Unit tests for ExternalSearchSessionModel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExternalSearchSessionModel } from '../../src/models/external/search-session.model.js';
import { Knex } from 'knex';

describe('ExternalSearchSessionModel', () => {
    let testModel: ExternalSearchSessionModel;
    let mockKnex: any;
    let mockQuery: any;

    // Helper to create fresh mock query builder with proper chaining
    const createMockQuery = () => {
        const query: any = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            offset: vi.fn().mockReturnThis(),
            then: vi.fn((cb: any) => Promise.resolve([]).then(cb)),
            // Mock where builder for complex search
            whereExists: vi.fn().mockReturnThis(),
            whereRaw: vi.fn().mockReturnThis(),
            orWhereRaw: vi.fn().mockReturnThis(),
        };
        return query;
    };

    beforeEach(() => {
        mockQuery = createMockQuery();
        mockKnex = {
            select: vi.fn().mockReturnValue(mockQuery),
            raw: vi.fn((sql) => sql),
        };

        testModel = new ExternalSearchSessionModel();
        // Inject mock knex
        (testModel as any).knex = mockKnex;
    });

    describe('findHistoryByUser', () => {
        const userEmail = 'test@example.com';
        const limit = 20;
        const offset = 0;

        it('should build correct query options without filters', async () => {
            const result = await testModel.findHistoryByUser(userEmail, limit, offset);

            expect(mockKnex.select).toHaveBeenCalled();
            expect(mockQuery.from).toHaveBeenCalledWith('external_search_sessions');
            expect(mockQuery.leftJoin).toHaveBeenCalledWith('knowledge_base_sources', 'external_search_sessions.share_id', 'knowledge_base_sources.share_id');
            expect(mockQuery.where).toHaveBeenCalledWith('external_search_sessions.user_email', userEmail);
            expect(mockQuery.orderBy).toHaveBeenCalledWith('external_search_sessions.updated_at', 'desc');
            expect(mockQuery.limit).toHaveBeenCalledWith(limit);
            expect(mockQuery.offset).toHaveBeenCalledWith(offset);
        });

        it('should apply date filters', async () => {
            const startDate = '2023-01-01';
            const endDate = '2023-01-31';

            await testModel.findHistoryByUser(userEmail, limit, offset, undefined, startDate, endDate);

            expect(mockQuery.where).toHaveBeenCalledWith('external_search_sessions.updated_at', '>=', startDate);
            expect(mockQuery.where).toHaveBeenCalledWith('external_search_sessions.updated_at', '<=', `${endDate} 23:59:59`);
        });
    });
});
