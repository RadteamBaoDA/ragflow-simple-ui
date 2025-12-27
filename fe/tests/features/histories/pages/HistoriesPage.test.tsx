/**
 * @fileoverview Unit tests for HistoriesPage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HistoriesPage from '../../../../src/features/histories/pages/HistoriesPage';
import * as historiesService from '../../../../src/features/histories/api/historiesService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock API service
vi.mock('../../../../src/features/histories/api/historiesService', () => ({
    fetchExternalChatHistory: vi.fn(),
    fetchExternalSearchHistory: vi.fn(),
    fetchChatSessionDetails: vi.fn(),
    fetchSearchSessionDetails: vi.fn(),
}));

// Mock child components
// vi.mock('../../../../src/components/Dialog', () => ({
//     Dialog: ({ children, open, title }: any) => open ? <div role="dialog" title={title}>{children}</div> : null,
// }));

// vi.mock('../../../../src/components/MarkdownRenderer', () => ({
//     MarkdownRenderer: ({ children }: any) => <div>{children}</div>
// }));

// Mock lucide-react
// vi.mock('lucide-react', () => ({
//     Filter: () => <div data-testid="icon-filter" />,
//     Search: () => <div data-testid="icon-search" />,
//     MessageSquare: () => <div data-testid="icon-message-square" />,
//     FileText: () => <div data-testid="icon-file-text" />,
//     Clock: () => <div data-testid="icon-clock" />,
//     User: () => <div data-testid="icon-user" />,
//     ChevronRight: () => <div data-testid="icon-chevron-right" />,
//     Sparkles: () => <div data-testid="icon-sparkles" />,
//     PanelLeftClose: () => <div data-testid="icon-panel-left-close" />,
//     PanelLeft: () => <div data-testid="icon-panel-left" />,
//     RefreshCw: () => <div data-testid="icon-refresh-cw" />,
// }));

const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

describe('HistoriesPage', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = createTestQueryClient();
        vi.clearAllMocks();
    });

    it('should render chat history tab by default', async () => {
        (historiesService.fetchExternalChatHistory as any).mockResolvedValue([]);

        render(
            <QueryClientProvider client={queryClient}>
                <HistoriesPage />
            </QueryClientProvider>
        );

        expect(screen.getByText('histories.chatTab')).toBeInTheDocument();
        // Since we are mocking translate with key return
        expect(screen.getByText('Conversation History')).toBeInTheDocument();
    });

    it('should switch to search history tab', async () => {
        (historiesService.fetchExternalChatHistory as any).mockResolvedValue([]);
        (historiesService.fetchExternalSearchHistory as any).mockResolvedValue([]);

        render(
            <QueryClientProvider client={queryClient}>
                <HistoriesPage />
            </QueryClientProvider>
        );

        const searchTab = screen.getByText('histories.searchTab');
        fireEvent.click(searchTab);

        await waitFor(() => {
            expect(screen.getByText('Search Session')).toBeInTheDocument();
        });
    });

    it('should display chat session list', async () => {
        const mockSessions: historiesService.ChatSessionSummary[] = [
            { session_id: '1', user_prompt: 'Test Prompt', user_email: 'user@test.com', created_at: new Date().toISOString(), message_count: 5, source_name: 'KB1' }
        ];
        (historiesService.fetchExternalChatHistory as any).mockResolvedValue(mockSessions);

        render(
            <QueryClientProvider client={queryClient}>
                <HistoriesPage />
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('Test Prompt')).toBeInTheDocument();
            expect(screen.getByText('user@test.com')).toBeInTheDocument();
        });
    });

    it('should load session details when clicked', async () => {
        const mockSessions: historiesService.ChatSessionSummary[] = [
            { session_id: '1', user_prompt: 'Test Prompt', created_at: new Date().toISOString(), message_count: 5 }
        ];
        const mockDetails: historiesService.ExternalChatHistory[] = [
            { id: '1', session_id: '1', user_prompt: 'Test Prompt', llm_response: 'Response', citations: [], created_at: new Date().toISOString() }
        ];

        (historiesService.fetchExternalChatHistory as any).mockResolvedValue(mockSessions);
        (historiesService.fetchChatSessionDetails as any).mockResolvedValue(mockDetails);

        render(
            <QueryClientProvider client={queryClient}>
                <HistoriesPage />
            </QueryClientProvider>
        );

        await waitFor(() => expect(screen.getByText('Test Prompt')).toBeInTheDocument());

        const sessionItem = screen.getByText('Test Prompt').closest('div[class*="cursor-pointer"]');
        if (sessionItem) fireEvent.click(sessionItem);

        await waitFor(() => {
            expect(historiesService.fetchChatSessionDetails).toHaveBeenCalledWith('1');
        });

        expect(await screen.findByText('Response')).toBeInTheDocument();
    });
});
