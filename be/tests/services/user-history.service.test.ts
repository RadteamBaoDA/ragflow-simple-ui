/**
 * @fileoverview Unit tests for UserHistoryService.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserHistoryService } from '../../src/modules/user-history/user-history.service.js';
import { ModelFactory } from '../../src/shared/models/factory.js';

describe('UserHistoryService', () => {
    let service: UserHistoryService;

    // Mock ModelFactory methods
    const mockFindHistory = vi.fn();
    const mockFindDetails = vi.fn();

    beforeEach(() => {
        // Reset mocks
        mockFindHistory.mockReset();
        mockFindDetails.mockReset();

        // Setup ModelFactory mocks
        // We need to overwrite the properties on the singleton ModelFactory or mock the getters
        // Typically ModelFactory properties are instances.

        // Let's assume we can spyOn/mock the global instance since it is imported singleton
        vi.spyOn(ModelFactory.externalChatSession, 'findHistoryByUser').mockImplementation(mockFindHistory);
        vi.spyOn(ModelFactory.externalSearchSession, 'findHistoryByUser').mockImplementation(mockFindHistory);
        vi.spyOn(ModelFactory.externalChatMessage, 'findBySessionIdAndUserEmail').mockImplementation(mockFindDetails);
        vi.spyOn(ModelFactory.externalSearchRecord, 'findBySessionIdAndUserEmail').mockImplementation(mockFindDetails);

        service = new UserHistoryService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getChatHistory', () => {
        it('should call ModelFactory.externalChatSession.findHistoryByUser with correct params', async () => {
            const email = 'user@example.com';
            const limit = 20;
            const page = 1;
            const search = 'test';
            const start = '2023-01-01';
            const end = '2023-01-31';

            mockFindHistory.mockResolvedValue([]);

            await service.getChatHistory(email, page, limit, search, start, end);

            expect(ModelFactory.externalChatSession.findHistoryByUser).toHaveBeenCalledWith(
                email,
                limit,
                0, // offset
                search,
                start,
                end
            );
        });
    });

    describe('getSearchHistory', () => {
        it('should call ModelFactory.externalSearchSession.findHistoryByUser with correct params', async () => {
            const email = 'user@example.com';
            const limit = 20;
            const page = 2; // page 2

            mockFindHistory.mockResolvedValue([]);

            await service.getSearchHistory(email, page, limit, '', '', '');

            expect(ModelFactory.externalSearchSession.findHistoryByUser).toHaveBeenCalledWith(
                email,
                limit,
                20, // offset = (2-1)*20
                '',
                '',
                ''
            );
        });
    });

    describe('getChatSessionDetails', () => {
        it('should call ModelFactory.externalChatMessage.findBySessionIdAndUserEmail', async () => {
            const session = 'session-123';
            const email = 'user@example.com';

            await service.getChatSessionDetails(session, email);

            expect(ModelFactory.externalChatMessage.findBySessionIdAndUserEmail).toHaveBeenCalledWith(session, email);
        });
    });

    describe('getSearchSessionDetails', () => {
        it('should call ModelFactory.externalSearchRecord.findBySessionIdAndUserEmail', async () => {
            const session = 'session-456';
            const email = 'user@example.com';

            await service.getSearchSessionDetails(session, email);

            expect(ModelFactory.externalSearchRecord.findBySessionIdAndUserEmail).toHaveBeenCalledWith(session, email);
        });
    });
});
