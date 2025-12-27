/**
 * @fileoverview Histories page component.
 * Displays system-wide or filtered chat and search history for administrators.
 * Supports infinite scrolling, filtering by email/date, and viewing detailed session logs.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    ChatSessionSummary,
    SearchSessionSummary,
    ExternalChatHistory,
    ExternalSearchHistory,
    FilterState,
    fetchExternalChatHistory,
    fetchExternalSearchHistory,
    fetchChatSessionDetails,
    fetchSearchSessionDetails
} from '@/features/histories/api/historiesService';
import { Filter, Search, MessageSquare, FileText, Clock, User, ChevronRight, Sparkles, PanelLeftClose, PanelLeft, RefreshCw } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

// ============================================================================
// Component
// ============================================================================

/**
 * HistoriesPage Component.
 * 
 * Manages the display and filtering of system-wide histories.
 * Features:
 * - Two tabs: Chat History and Search History
 * - Infinite scrolling for session lists
 * - Sidebar filtering by Date and Email
 * - Detailed view of selected session
 */
function HistoriesPage() {
    const { t } = useTranslation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [activeTab, setActiveTab] = useState<'chat' | 'search'>('chat');
    const [selectedSession, setSelectedSession] = useState<ChatSessionSummary | SearchSessionSummary | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [executedSearchQuery, setExecutedSearchQuery] = useState('');
    const [filters, setFilters] = useState<FilterState>({ email: '', startDate: '', endDate: '', sourceName: '' });
    const [tempFilters, setTempFilters] = useState<FilterState>({ email: '', startDate: '', endDate: '', sourceName: '' });
    const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const {
        data: chatData,
        fetchNextPage: fetchNextChatPage,
        hasNextPage: hasNextChatPage,
        isFetchingNextPage: isFetchingNextChatPage,
        isLoading: isLoadingChat,
        refetch: refetchChat,
        isRefetching: isRefetchingChat
    } = useInfiniteQuery({
        queryKey: ['externalChatHistory', executedSearchQuery, filters],
        queryFn: ({ pageParam = 1 }) => fetchExternalChatHistory(executedSearchQuery, filters, pageParam),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === 20 ? allPages.length + 1 : undefined;
        },
        enabled: activeTab === 'chat',
    });

    const {
        data: searchData,
        fetchNextPage: fetchNextSearchPage,
        hasNextPage: hasNextSearchPage,
        isFetchingNextPage: isFetchingNextSearchPage,
        isLoading: isLoadingSearch,
        refetch: refetchSearch,
        isRefetching: isRefetchingSearch
    } = useInfiniteQuery({
        queryKey: ['externalSearchHistory', executedSearchQuery, filters],
        queryFn: ({ pageParam = 1 }) => fetchExternalSearchHistory(executedSearchQuery, filters, pageParam),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === 20 ? allPages.length + 1 : undefined;
        },
        enabled: activeTab === 'search',
    });

    // Fetch Details Query
    const {
        data: sessionDetails,
        isLoading: isLoadingDetails,
        refetch: refetchDetails,
        isRefetching: isRefetchingDetails
    } = useQuery<ExternalChatHistory[] | ExternalSearchHistory[]>({
        queryKey: ['sessionDetails', activeTab, selectedSession?.session_id],
        queryFn: async () => {
            if (!selectedSession?.session_id) return [];
            if (activeTab === 'chat') {
                return fetchChatSessionDetails(selectedSession.session_id);
            } else {
                return fetchSearchSessionDetails(selectedSession.session_id);
            }
        },
        enabled: !!selectedSession?.session_id
    });

    const isLoading = activeTab === 'chat' ? isLoadingChat : isLoadingSearch;
    const isFetchingNextPage = activeTab === 'chat' ? isFetchingNextChatPage : isFetchingNextSearchPage;
    const hasNextPage = activeTab === 'chat' ? hasNextChatPage : hasNextSearchPage;
    const fetchNextPage = activeTab === 'chat' ? fetchNextChatPage : fetchNextSearchPage;

    const flattenedData = useMemo(() => {
        const pages = activeTab === 'chat' ? chatData?.pages : searchData?.pages;
        return pages?.flat() || [];
    }, [activeTab, chatData, searchData]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    /**
     * Handle search form submission.
     * Triggers a new query by updating executedSearchQuery.
     */
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setExecutedSearchQuery(searchQuery);
        setSelectedSession(null); // Reset selection to trigger auto-select of first item
    };

    /**
     * Apply the selected filters from the dialog.
     */
    const handleApplyFilters = () => {
        setFilters(tempFilters);
        setIsFilterDialogOpen(false);
    };

    /**
     * Reset filters to default empty state.
     */
    const handleResetFilters = () => {
        const reseted = { email: '', startDate: '', endDate: '', sourceName: '' };
        setTempFilters(reseted);
        setFilters(reseted);
    };

    /**
     * Refresh current data.
     */
    const handleRefresh = () => {
        if (activeTab === 'chat') refetchChat();
        else refetchSearch();
        if (selectedSession) refetchDetails();
    };

    const isRefreshing = (activeTab === 'chat' ? isRefetchingChat : isRefetchingSearch) || isRefetchingDetails;

    // Auto-select first item when data loads if no item is selected
    useEffect(() => {
        if (!selectedSession && flattenedData.length > 0) {
            setSelectedSession(flattenedData[0] as ChatSessionSummary | SearchSessionSummary);
        }
    }, [flattenedData, selectedSession]);

    const isFiltered = filters.email || filters.startDate || filters.endDate || filters.sourceName;

    return (
        <div>Hello</div>
    );
}

/**
 * Helper component for highlighting matching text in search results.
 * 
 * @param {object} props
 * @param {string} props.text - The text to display.
 * @param {string} props.query - The search query to highlight.
 */
const HighlightMatch = ({ text, query }: { text: string; query: string }) => {
    if (!query || !text) return <>{text}</>;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
        <span>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-slate-900 dark:text-slate-100 rounded-sm px-0.5">
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </span>
    );
};

export default HistoriesPage;
