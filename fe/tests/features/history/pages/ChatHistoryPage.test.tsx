/**
 * @fileoverview Unit tests for ChatHistoryPage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatHistoryPage from '../../../src/features/history/pages/ChatHistoryPage';
import * as historyService from '../../../src/features/history/api/historyService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock API service
vi.mock('../../../src/features/history/api/historyService', () => ({
    fetchChatHistory: vi.fn(),
    fetchChatSessionDetails: vi.fn(),
}));

// Setup QueryClient for testing
const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

describe('ChatHistoryPage', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = createTestQueryClient();
        vi.clearAllMocks();
    });

    it('should render loading state initially', () => {
        (historyService.fetchChatHistory as any).mockResolvedValue([]);

        render(
            <QueryClientProvider client={queryClient}>
                <ChatHistoryPage />
            </QueryClientProvider>
        );

        // Sidebar uses isLoading internally from useInfiniteQuery
        // We verify that the structure is present
        expect(screen.getByText('userHistory.chatHistory')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('userHistory.searchPlaceholder')).toBeInTheDocument();
    });

    it('should display chat sessions', async () => {
        const mockSessions: historyService.ChatSessionSummary[] = [
            { session_id: '1', user_prompt: 'Hello AI', created_at: new Date().toISOString(), message_count: 5, source_name: 'KB1' }
        ];
        (historyService.fetchChatHistory as any).mockResolvedValue(mockSessions);

        render(
            <QueryClientProvider client={queryClient}>
                <ChatHistoryPage />
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('Hello AI')).toBeInTheDocument();
            expect(screen.getByText('KB1')).toBeInTheDocument();
        });
    });

    it('should load session details when clicked', async () => {
        const mockSessions: historyService.ChatSessionSummary[] = [
            { session_id: '1', user_prompt: 'Hello AI', created_at: new Date().toISOString(), message_count: 5 }
        ];
        const mockDetails: historyService.ExternalChatHistory[] = [
            { id: 'msg1', session_id: '1', user_prompt: 'Hello AI', llm_response: 'Hi there', citations: [], created_at: new Date().toISOString() }
        ];

        (historyService.fetchChatHistory as any).mockResolvedValue(mockSessions);
        (historyService.fetchChatSessionDetails as any).mockResolvedValue(mockDetails);

        render(
            <QueryClientProvider client={queryClient}>
                <ChatHistoryPage />
            </QueryClientProvider>
        );

        // Wait for list to load
        await waitFor(() => expect(screen.getByText('Hello AI')).toBeInTheDocument());

        // Click on session
        const sessionItem = screen.getByText('Hello AI').closest('div[class*="cursor-pointer"]');
        if (sessionItem) fireEvent.click(sessionItem);

        // Verify details fetch call
        await waitFor(() => {
            expect(historyService.fetchChatSessionDetails).toHaveBeenCalledWith('1');
        });

        // Verify content rendered
        expect(await screen.findByText('Hi there')).toBeInTheDocument();
    });
});
