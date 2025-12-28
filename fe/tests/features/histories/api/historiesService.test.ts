/**
 * @fileoverview Unit tests for historiesService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    fetchExternalChatHistory,
    fetchExternalSearchHistory,
    fetchChatSessionDetails,
    fetchSearchSessionDetails,
    FilterState
} from '../../../../src/features/histories/api/historiesService';
import { apiFetch } from '../../../../src/lib/api';

// Mock apiFetch
vi.mock('../../../../src/lib/api', () => ({
    apiFetch: vi.fn()
}));

describe('historiesService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchExternalChatHistory', () => {
        it('should call apiFetch with correct parameters', async () => {
            const search = 'test';
            const filters: FilterState = { email: 'user@test.com', startDate: '2023-01-01', endDate: '2023-01-31', sourceName: 'kb1' };
            const page = 1;

            await fetchExternalChatHistory(search, filters, page);

            expect(apiFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/admin/history/chat?q=test&email=user%40test.com&startDate=2023-01-01&endDate=2023-01-31&sourceName=kb1&page=1&limit=20')
            );
        });
    });

    describe('fetchExternalSearchHistory', () => {
        it('should call apiFetch with correct parameters', async () => {
            const search = 'test';
            const filters: FilterState = { email: '', startDate: '', endDate: '', sourceName: '' };
            const page = 2;

            await fetchExternalSearchHistory(search, filters, page);

            expect(apiFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/admin/history/search?q=test&email=&startDate=&endDate=&sourceName=&page=2&limit=20')
            );
        });
    });

    describe('fetchChatSessionDetails', () => {
        it('should call apiFetch with correct session ID', async () => {
            const sessionId = 'session-123';
            await fetchChatSessionDetails(sessionId);

            expect(apiFetch).toHaveBeenCalledWith(`/api/admin/history/chat/${sessionId}`);
        });
    });

    describe('fetchSearchSessionDetails', () => {
        it('should call apiFetch with correct session ID', async () => {
            const sessionId = 'session-456';
            await fetchSearchSessionDetails(sessionId);

            expect(apiFetch).toHaveBeenCalledWith(`/api/admin/history/search/${sessionId}`);
        });
    });
});
