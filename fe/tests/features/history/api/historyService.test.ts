/**
 * @fileoverview Unit tests for historyService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    fetchChatHistory,
    fetchChatSessionDetails,
    fetchSearchHistory,
    fetchSearchSessionDetails,
    FilterState
} from '../../../src/features/history/api/historyService';
import { apiFetch } from '../../../src/lib/api';

// Mock apiFetch
vi.mock('../../../src/lib/api', () => ({
    apiFetch: vi.fn()
}));

describe('historyService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchChatHistory', () => {
        it('should call apiFetch with correct parameters', async () => {
            const search = 'test';
            const filters: FilterState = { startDate: '2023-01-01', endDate: '2023-01-31' };
            const page = 1;

            await fetchChatHistory(search, filters, page);

            expect(apiFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/user/history/chat?q=test&startDate=2023-01-01&endDate=2023-01-31&page=1&limit=20')
            );
        });
    });

    describe('fetchChatSessionDetails', () => {
        it('should call apiFetch with correct session ID', async () => {
            const sessionId = 'session-123';
            await fetchChatSessionDetails(sessionId);

            expect(apiFetch).toHaveBeenCalledWith(`/api/user/history/chat/${sessionId}`);
        });
    });

    describe('fetchSearchHistory', () => {
        it('should call apiFetch with correct parameters', async () => {
            const search = 'query';
            const filters: FilterState = { startDate: '', endDate: '' };
            const page = 2;

            await fetchSearchHistory(search, filters, page);

            expect(apiFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/user/history/search?q=query&startDate=&endDate=&page=2&limit=20')
            );
        });
    });

    describe('fetchSearchSessionDetails', () => {
        it('should call apiFetch with correct session ID', async () => {
            const sessionId = 'session-456';
            await fetchSearchSessionDetails(sessionId);

            expect(apiFetch).toHaveBeenCalledWith(`/api/user/history/search/${sessionId}`);
        });
    });
});
