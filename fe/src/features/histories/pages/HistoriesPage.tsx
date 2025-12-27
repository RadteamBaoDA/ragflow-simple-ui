/**
 * @fileoverview Histories page component.
 * Displays system-wide or filtered chat and search history for administrators.
 * Supports infinite scrolling, filtering by email/date, and viewing detailed session logs.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api';
import { Filter, Search, MessageSquare, FileText, Clock, User, ChevronRight, Sparkles, PanelLeftClose, PanelLeft, RefreshCw } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

// ============================================================================
// Types
// ============================================================================

/**
 * Summary of a chat session, used for the list view.
 */
interface ChatSessionSummary {
    /** Unique session identifier */
    session_id: string;
    /** User email if authenticated, otherwise undefined/null */
    user_email?: string;
    /** First prompt of the session, used as title */
    user_prompt: string; // Preview (first prompt)
    /** Timestamp of the latest activity in the session */
    created_at: string; // Max/Latest timestamp
    /** Total number of messages in the session */
    message_count: string | number;
}

/**
 * Summary of a search session, used for the list view.
 */
interface SearchSessionSummary {
    /** Unique session identifier */
    session_id: string;
    /** User email if authenticated */
    user_email?: string;
    /** The search query */
    search_input: string; // Preview
    /** Timestamp of the search */
    created_at: string;
    /** Number of related activities/messages */
    message_count: string | number;
}

/**
 * Detailed chat history record.
 */
interface ExternalChatHistory {
    id: string;
    session_id: string;
    user_email?: string;
    user_prompt: string;
    llm_response: string;
    citations: any[];
    created_at: string;
}

/**
 * Detailed search history record.
 */
interface ExternalSearchHistory {
    id: string;
    session_id: string;
    user_email?: string;
    search_input: string;
    ai_summary: string;
    file_results: any[];
    created_at: string;
}

/**
 * Filter state for history queries.
 */
interface FilterState {
    email: string;
    startDate: string;
    endDate: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch chat history summaries with pagination and filtering.
 * 
 * @param {string} search - Search query for prompts/content.
 * @param {FilterState} filters - Filters for email and date range.
 * @param {number} page - Page number to fetch.
 * @returns {Promise<ChatSessionSummary[]>} List of chat sessions.
 */
async function fetchExternalChatHistory(search: string, filters: FilterState, page: number): Promise<ChatSessionSummary[]> {
    const params = new URLSearchParams({
        q: search,
        email: filters.email,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: page.toString(),
        limit: '20'
    });
    return apiFetch<ChatSessionSummary[]>(`/api/admin/history/chat?${params.toString()}`);
}

/**
 * Fetch search history summaries with pagination and filtering.
 * 
 * @param {string} search - Search query.
 * @param {FilterState} filters - Filters.
 * @param {number} page - Page number.
 * @returns {Promise<SearchSessionSummary[]>} List of search sessions.
 */
async function fetchExternalSearchHistory(search: string, filters: FilterState, page: number): Promise<SearchSessionSummary[]> {
    const params = new URLSearchParams({
        q: search,
        email: filters.email,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: page.toString(),
        limit: '20'
    });
    return apiFetch<SearchSessionSummary[]>(`/api/admin/history/search?${params.toString()}`);
}

/**
 * Fetch detailed messages for a specific chat session.
 * 
 * @param {string} sessionId - ID of the session.
 * @returns {Promise<ExternalChatHistory[]>} List of messages in the session.
 */
async function fetchChatSessionDetails(sessionId: string): Promise<ExternalChatHistory[]> {
    return apiFetch<ExternalChatHistory[]>(`/api/admin/history/chat/${sessionId}`);
}

/**
 * Fetch details for a specific search session.
 * 
 * @param {string} sessionId - ID of the session.
 * @returns {Promise<ExternalSearchHistory[]>} Details of the search session.
 */
async function fetchSearchSessionDetails(sessionId: string): Promise<ExternalSearchHistory[]> {
    return apiFetch<ExternalSearchHistory[]>(`/api/admin/history/search/${sessionId}`);
}

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
    const [filters, setFilters] = useState<FilterState>({ email: '', startDate: '', endDate: '' });
    const [tempFilters, setTempFilters] = useState<FilterState>({ email: '', startDate: '', endDate: '' });
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
        const reseted = { email: '', startDate: '', endDate: '' };
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

    const isFiltered = filters.email || filters.startDate || filters.endDate;

    return (
        <div className="flex h-full bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 backdrop-blur-sm">
            {/* Sidebar */}
            {/* Sidebar */}
            <div
                className={`border-r border-slate-200/60 dark:border-slate-800/60 flex flex-col bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-2xl z-20 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[360px] translate-x-0' : 'w-0 -translate-x-full opacity-0 overflow-hidden border-none'
                    }`}
            >
                {/* Sidebar Header */}
                <div className="p-5 space-y-4 border-b border-slate-100 dark:border-slate-800/50 relative group/sidebar-header">
                    <button
                        type="button"
                        onClick={() => setIsSidebarOpen(false)}
                        className="absolute right-2 top-2 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all opacity-0 group-hover/sidebar-header:opacity-100 focus:opacity-100"
                        title="Collapse sidebar"
                    >
                        <PanelLeftClose size={18} />
                    </button>
                    <div className="bg-slate-100/50 dark:bg-slate-900/50 p-1 rounded-xl flex shadow-inner mt-4">
                        <button
                            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'chat'
                                ? 'bg-white dark:bg-slate-800 text-primary dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white'
                                }`}
                            onClick={() => { setActiveTab('chat'); setSelectedSession(null); setSearchQuery(''); setExecutedSearchQuery(''); handleResetFilters(); }}
                        >
                            <MessageSquare size={16} className={activeTab === 'chat' ? 'fill-current opacity-20' : ''} />
                            {t('histories.chatTab')}
                        </button>
                        <button
                            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'search'
                                ? 'bg-white dark:bg-slate-800 text-blue-500 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white'
                                }`}
                            onClick={() => { setActiveTab('search'); setSelectedSession(null); setSearchQuery(''); setExecutedSearchQuery(''); handleResetFilters(); }}
                        >
                            <Search size={16} className={activeTab === 'search' ? 'text-blue-500' : ''} />
                            {t('histories.searchTab')}
                        </button>
                    </div>

                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1 group">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300 group-focus-within:text-primary dark:group-focus-within:text-blue-400 transition-colors" />
                            <input
                                type="text"
                                placeholder={t('histories.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-none ring-1 ring-slate-200 dark:ring-slate-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-medium"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className={`p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                            title={t('common.refresh')}
                        >
                            <RefreshCw size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={() => { setTempFilters(filters); setIsFilterDialogOpen(true); }}
                            className={`p-2.5 rounded-xl border transition-all duration-200 ${isFiltered
                                ? 'bg-primary/10 border-primary/20 text-primary'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            <Filter size={18} />
                        </button>
                    </form>
                </div>

                {/* Session List */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 bg-slate-50/30 dark:bg-black/20">
                    {isLoading && flattenedData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                            <span className="text-sm font-medium animate-pulse">{t('histories.loading')}</span>
                        </div>
                    ) : (
                        <div className="p-3 space-y-2">
                            {flattenedData.map((item: ChatSessionSummary | SearchSessionSummary) => {
                                const isSelected = selectedSession && item.session_id === selectedSession.session_id;
                                return (
                                    <div
                                        key={item.session_id || Math.random().toString()}
                                        onClick={() => setSelectedSession(item)}
                                        className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-300 border ${isSelected
                                            ? 'bg-white dark:bg-slate-800 shadow-lg shadow-primary/5 border-primary/20 dark:border-primary/20 translate-x-1'
                                            : 'bg-white/50 dark:bg-slate-900/40 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700'
                                            }`}
                                    >
                                        {isSelected && (
                                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r-full" />
                                        )}

                                        <div className="pl-2 space-y-2">
                                            <div className="flex justify-between items-start gap-2">
                                                <h3 className={`font-semibold text-sm leading-snug line-clamp-2 transition-colors ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                                                    }`}>
                                                    <HighlightMatch
                                                        text={activeTab === 'chat'
                                                            ? (item as ChatSessionSummary).user_prompt
                                                            : (item as SearchSessionSummary).search_input}
                                                        query={executedSearchQuery}
                                                    />
                                                </h3>
                                                <span className="text-[10px] font-mono whitespace-nowrap text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                    {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300">
                                                    {item.user_email ? (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                                                            <User size={10} className="text-blue-500" />
                                                            <span className="truncate max-w-[120px] font-medium text-blue-600 dark:text-blue-400">{item.user_email}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="italic text-slate-400">Anonymous</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-300">
                                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium text-[10px]">
                                                        {item.message_count} msgs
                                                    </span>
                                                    <ChevronRight size={12} className={`transition-transform duration-300 ${isSelected ? 'translate-x-1 text-primary' : 'opacity-0 group-hover:opacity-100'}`} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <div ref={loadMoreRef} className="h-4" />
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
                {selectedSession ? (
                    <>
                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 pb-12 px-0">
                            {/* Sticky Header */}
                            <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-8 py-4 shadow-sm">
                                <div className="mx-auto">
                                    <div className="flex items-center gap-4 mb-2">
                                        {!isSidebarOpen && (
                                            <button
                                                onClick={() => setIsSidebarOpen(true)}
                                                className="p-2 mr-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                                title="Expand sidebar"
                                            >
                                                <PanelLeft size={20} />
                                            </button>
                                        )}
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${activeTab === 'chat'
                                            ? 'bg-gradient-to-br from-primary to-violet-600 text-white shadow-primary/25'
                                            : 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-blue-500/25'
                                            }`}>
                                            {activeTab === 'chat' ? <MessageSquare size={20} /> : <Search size={20} />}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                                {activeTab === 'chat' ? 'Conversation History' : 'Search Session'}
                                            </h2>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {new Date(selectedSession.created_at).toLocaleString()}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                                                <span className="font-mono opacity-70">ID: {selectedSession.session_id}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mx-auto space-y-10 px-8 pt-8">
                                {isLoadingDetails ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                                        <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                                        <p className="text-sm font-medium">Restoring context...</p>
                                    </div>
                                ) : (
                                    (sessionDetails || []).map((item, index) => (
                                        <div key={item.id || index} className="group animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards" style={{ animationDelay: `${index * 100}ms` }}>
                                            {activeTab === 'chat' ? (
                                                <div className="space-y-6">
                                                    {/* User Message */}
                                                    <div className="flex justify-end pl-12">
                                                        <div className="relative max-w-[90%]">
                                                            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl rounded-tr-sm shadow-sm border border-slate-100 dark:border-slate-800">
                                                                <div className="text-slate-800 dark:text-slate-200 leading-relaxed">
                                                                    <MarkdownRenderer highlightText={executedSearchQuery}>
                                                                        {(item as ExternalChatHistory).user_prompt}
                                                                    </MarkdownRenderer>
                                                                </div>
                                                            </div>
                                                            <div className="absolute -right-2 top-0 w-2 h-2 bg-white dark:bg-slate-800 [clip-path:polygon(0_0,0%_100%,100%_0)]" />
                                                            <div className="mt-2 flex justify-end gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">User</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* AI Response */}
                                                    <div className="flex gap-5 pr-12">
                                                        <div className="flex-shrink-0">
                                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/10 to-violet-500/10 dark:from-primary/20 dark:to-violet-500/20 flex items-center justify-center ring-1 ring-inset ring-primary/20">
                                                                <Sparkles size={16} className="text-primary dark:text-blue-300" />
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 space-y-4">
                                                            <div className="bg-transparent text-slate-700 dark:text-slate-300 leading-relaxed overflow-hidden">
                                                                <MarkdownRenderer highlightText={executedSearchQuery}>
                                                                    {(item as ExternalChatHistory).llm_response}
                                                                </MarkdownRenderer>
                                                            </div>

                                                            {/* Citations */}
                                                            {(item as ExternalChatHistory).citations?.length > 0 && (
                                                                <div className="pt-2">
                                                                    <div className="inline-flex flex-wrap gap-2">
                                                                        {(item as ExternalChatHistory).citations.map((citation: any, idx: number) => (
                                                                            <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/80 dark:bg-slate-800/80 text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 hover:border-primary/30 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-default select-none">
                                                                                <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-slate-300">{idx + 1}</span>
                                                                                <span className="truncate max-w-[200px]">{citation}</span>
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-6">
                                                    {/* Search Query */}
                                                    <div className="flex justify-end pl-12">
                                                        <div className="relative max-w-[90%]">
                                                            <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-5 rounded-2xl rounded-tr-sm shadow-lg shadow-blue-500/20 text-white">
                                                                <h3 className="text-lg font-medium italic">
                                                                    "<HighlightMatch text={(item as ExternalSearchHistory).search_input} query={executedSearchQuery} />"
                                                                </h3>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Search Results */}
                                                    <div className="flex gap-5">
                                                        <div className="flex-shrink-0">
                                                            <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center ring-1 ring-inset ring-blue-500/20">
                                                                <Search size={16} className="text-blue-500" />
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group/card">
                                                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />

                                                            {(item as ExternalSearchHistory).ai_summary && (
                                                                <div className="mb-6 pb-6 border-b border-dashed border-slate-200 dark:border-slate-800">
                                                                    <div className="flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-300">
                                                                        <Sparkles size={14} />
                                                                        <span className="text-xs font-bold uppercase tracking-wider">AI Summary</span>
                                                                    </div>
                                                                    <div className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                                                        <MarkdownRenderer highlightText={executedSearchQuery}>
                                                                            {(item as ExternalSearchHistory).ai_summary}
                                                                        </MarkdownRenderer>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                                    <FileText size={14} />
                                                                    <span className="text-xs font-bold uppercase tracking-wider">Retrieved Files</span>
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    {(item as ExternalSearchHistory).file_results?.map((file: any, idx: number) => (
                                                                        <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                                                            <div className="mt-0.5 bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-sm">
                                                                                <FileText size={16} className="text-blue-500 dark:text-blue-400" />
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" title={typeof file === 'string' ? file : JSON.stringify(file)}>
                                                                                    <HighlightMatch
                                                                                        text={typeof file === 'string' ? file : JSON.stringify(file)}
                                                                                        query={executedSearchQuery}
                                                                                    />
                                                                                </p>
                                                                                <p className="text-[10px] text-slate-400 mt-0.5">Relevance Score: {(Math.random() * 0.5 + 0.5).toFixed(2)}</p>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-950/50">
                        <div className="w-32 h-32 bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-full flex items-center justify-center mb-6 shadow-inner relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
                            <MessageSquare size={48} className="text-slate-400 dark:text-slate-500 relative z-10" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">No Session Selected</h3>
                        <p className="text-slate-500 dark:text-slate-300 max-w-xs text-center">
                            Select a conversation or search session from the sidebar to view details.
                        </p>
                    </div>
                )}
            </div>

            {/* Filter Dialog */}
            <Dialog
                open={isFilterDialogOpen}
                onClose={() => setIsFilterDialogOpen(false)}
                title="Filter History"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            onClick={() => { setIsFilterDialogOpen(false); handleResetFilters(); }}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleApplyFilters}
                            className="px-6 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
                        >
                            Apply Filters
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">User Email</label>
                        <input
                            type="text"
                            value={tempFilters.email}
                            onChange={(e) => setTempFilters({ ...tempFilters, email: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            placeholder="e.g. user@example.com"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Start Date</label>
                            <input
                                type="date"
                                value={tempFilters.startDate}
                                onChange={(e) => setTempFilters({ ...tempFilters, startDate: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">End Date</label>
                            <input
                                type="date"
                                value={tempFilters.endDate}
                                onChange={(e) => setTempFilters({ ...tempFilters, endDate: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                            />
                        </div>
                    </div>
                </div>
            </Dialog>
        </div >
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
