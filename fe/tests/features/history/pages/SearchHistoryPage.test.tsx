/**
 * @fileoverview Unit tests for SearchHistoryPage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchHistoryPage from '../../../src/features/history/pages/SearchHistoryPage';
import * as historyService from '../../../src/features/history/api/historyService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock API service
vi.mock('../../../src/features/history/api/historyService', () => ({
    fetchSearchHistory: vi.fn(),
    fetchSearchSessionDetails: vi.fn(),
}));

// Setup QueryClient for testing
const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

describe('SearchHistoryPage', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = createTestQueryClient();
        vi.clearAllMocks();
    });

    it('should render loading state initially', () => {
        (historyService.fetchSearchHistory as any).mockResolvedValue([]);

        render(
            <QueryClientProvider client={queryClient}>
                <SearchHistoryPage />
            </QueryClientProvider>
        );

        expect(screen.getByText('userHistory.searchHistory')).toBeInTheDocument();
    });

    it('should display search sessions', async () => {
        const mockSessions: historyService.SearchSessionSummary[] = [
            { session_id: '1', search_input: 'Quantum Physics', created_at: new Date().toISOString(), message_count: 5, source_name: 'ScienceKB' }
        ];
        (historyService.fetchSearchHistory as any).mockResolvedValue(mockSessions);

        render(
            <QueryClientProvider client={queryClient}>
                <SearchHistoryPage />
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('Quantum Physics')).toBeInTheDocument();
            expect(screen.getByText('ScienceKB')).toBeInTheDocument();
        });
    });

    it('should load session details when clicked', async () => {
        const mockSessions: historyService.SearchSessionSummary[] = [
            { session_id: '1', search_input: 'Quantum Physics', created_at: new Date().toISOString(), message_count: 5 }
        ];
        const mockDetails: historyService.ExternalSearchHistory[] = [
            { id: 'rec1', session_id: '1', search_input: 'Quantum Physics', ai_summary: 'Summary here', file_results: [], created_at: new Date().toISOString() }
        ];

        (historyService.fetchSearchHistory as any).mockResolvedValue(mockSessions);
        (historyService.fetchSearchSessionDetails as any).mockResolvedValue(mockDetails);

        render(
            <QueryClientProvider client={queryClient}>
                <SearchHistoryPage />
            </QueryClientProvider>
        );

        // Wait for list to load
        await waitFor(() => expect(screen.getByText('Quantum Physics')).toBeInTheDocument());

        // Click on session
        const sessionItem = screen.getByText('Quantum Physics').closest('div[class*="cursor-pointer"]');
        if (sessionItem) fireEvent.click(sessionItem);

        // Verify details fetch call
        await waitFor(() => {
            expect(historyService.fetchSearchSessionDetails).toHaveBeenCalledWith('1');
        });

        // Verify content rendered
        expect(await screen.findByText('Summary here')).toBeInTheDocument();
    });
});
