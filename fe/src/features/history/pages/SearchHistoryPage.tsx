/**
 * @fileoverview Search History page component.
 * Displays user's personal search history with filtering and detail view.
 * UI pattern follows HistoriesPage but for single user's search sessions only.
 * 
 * @module features/history/pages/SearchHistoryPage
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';

import { Filter, Search, FileText, Clock, ChevronRight, Sparkles, PanelLeftClose, PanelLeft, RefreshCw } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

import { SearchSessionSummary, ExternalSearchHistory, FilterState, fetchSearchHistory, fetchSearchSessionDetails } from '@/features/history/api/historyService';

// ============================================================================
// Component
// ============================================================================

/**
 * SearchHistoryPage Component.
 * 
 * Displays the user's personal search history with:
 * - Infinite scrolling session list
 * - Search and date filtering
 * - Detailed view with AI summary and file results
 */
function SearchHistoryPage() {
    const { t } = useTranslation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [selectedSession, setSelectedSession] = useState<SearchSessionSummary | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [executedSearchQuery, setExecutedSearchQuery] = useState('');
    const [filters, setFilters] = useState<FilterState>({ startDate: '', endDate: '' });
    const [tempFilters, setTempFilters] = useState<FilterState>({ startDate: '', endDate: '' });
    const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Fetch search history with infinite scrolling
    const {
        data: searchData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        refetch,
        isRefetching
    } = useInfiniteQuery({
        queryKey: ['userSearchHistory', executedSearchQuery, filters],
        queryFn: ({ pageParam = 1 }) => fetchSearchHistory(executedSearchQuery, filters, pageParam),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === 20 ? allPages.length + 1 : undefined;
        },
        // Force refetch when navigating back to this page to get latest data
        refetchOnMount: 'always',
    });

    // Fetch session details when a session is selected
    const {
        data: sessionDetails,
        isLoading: isLoadingDetails,
        refetch: refetchDetails,
        isRefetching: isRefetchingDetails
    } = useQuery<ExternalSearchHistory[]>({
        queryKey: ['searchSessionDetails', selectedSession?.session_id],
        queryFn: async () => {
            if (!selectedSession?.session_id) return [];
            return fetchSearchSessionDetails(selectedSession.session_id);
        },
        enabled: !!selectedSession?.session_id
    });

    // Flatten paginated data
    const flattenedData = useMemo(() => {
        return searchData?.pages?.flat() || [];
    }, [searchData]);

    // Infinite scroll observer
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
     */
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setExecutedSearchQuery(searchQuery);
        setSelectedSession(null);
    };

    /**
     * Apply filters from dialog.
     */
    const handleApplyFilters = () => {
        setFilters(tempFilters);
        setIsFilterDialogOpen(false);
    };

    /**
     * Reset filters to default.
     */
    const handleResetFilters = () => {
        const reset = { startDate: '', endDate: '' };
        setTempFilters(reset);
        setFilters(reset);
    };

    /**
     * Refresh data.
     */
    const handleRefresh = () => {
        refetch();
        if (selectedSession) refetchDetails();
    };

    const isRefreshing = isRefetching || isRefetchingDetails;

    // Auto-select first item when data loads
    useEffect(() => {
        if (!selectedSession && flattenedData.length > 0) {
            setSelectedSession(flattenedData[0] ?? null);
        }
    }, [flattenedData, selectedSession]);

    const isFiltered = filters.startDate || filters.endDate;

    return (
        <div className="flex h-full bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 backdrop-blur-sm">
            {/* Sidebar */}
            <div
                className={`border-r border-slate-200/60 dark:border-slate-800/60 flex flex-col bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-2xl z-20 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[360px] translate-x-0' : 'w-0 -translate-x-full opacity-0 overflow-hidden border-none'}`}
            >
                {/* Sidebar Header */}
                <div className="p-5 space-y-4 border-b border-slate-100 dark:border-slate-800/50 relative group/sidebar-header">
                    <button
                        type="button"
                        onClick={() => setIsSidebarOpen(false)}
                        className="absolute right-2 top-2 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all opacity-0 group-hover/sidebar-header:opacity-100 focus:opacity-100"
                        title={t('common.close')}
                    >
                        <PanelLeftClose size={18} />
                    </button>

                    <div className="flex items-center gap-3 mt-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <Search size={20} className="text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('userHistory.searchHistory')}</h2>
                    </div>

                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1 group">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors" />
                            <input
                                type="text"
                                placeholder={t('userHistory.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-none ring-1 ring-slate-200 dark:ring-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-medium"
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
                                ? 'bg-blue-500/10 border-blue-500/20 text-blue-500'
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
                            <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                            <span className="text-sm font-medium animate-pulse">{t('userHistory.loading')}</span>
                        </div>
                    ) : flattenedData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
                            <Search size={48} className="opacity-30" />
                            <span className="text-sm font-medium">{t('userHistory.noSessions')}</span>
                        </div>
                    ) : (
                        <div className="p-3 space-y-2">
                            {flattenedData.map((item: SearchSessionSummary) => {
                                const isSelected = selectedSession && item.session_id === selectedSession.session_id;
                                return (
                                    <div
                                        key={item.session_id || Math.random().toString()}
                                        onClick={() => setSelectedSession(item)}
                                        className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-300 border ${isSelected
                                            ? 'bg-white dark:bg-slate-800 shadow-lg shadow-blue-500/5 border-blue-500/20 dark:border-blue-500/20 translate-x-1'
                                            : 'bg-white/50 dark:bg-slate-900/40 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700'
                                            }`}
                                    >
                                        {isSelected && (
                                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-full" />
                                        )}

                                        <div className="pl-2 space-y-2">
                                            <div className="flex justify-between items-start gap-2">
                                                <h3 className={`font-semibold text-sm leading-snug line-clamp-2 transition-colors ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    <HighlightMatch text={item.search_input} query={executedSearchQuery} />
                                                </h3>
                                                <span className="text-[10px] font-mono whitespace-nowrap text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                    {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between text-xs mt-2">
                                                <div className="flex items-center gap-2">
                                                    {item.source_name && (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-50/50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/30">
                                                            <span className="truncate max-w-[100px] font-bold text-[10px] text-violet-600 dark:text-violet-400 uppercase tracking-wide">{item.source_name}</span>
                                                        </div>
                                                    )}
                                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium text-[10px] text-slate-400 dark:text-slate-300">
                                                        {item.message_count} results
                                                    </span>
                                                </div>
                                                <ChevronRight size={12} className={`transition-transform duration-300 ${isSelected ? 'translate-x-1 text-blue-500' : 'opacity-0 group-hover:opacity-100'}`} />
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
                                                className="p-2 mr-2 rounded-lg text-slate-500 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                                title={t('nav.expandMenu')}
                                            >
                                                <PanelLeft size={20} />
                                            </button>
                                        )}
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-blue-500/25">
                                            <Search size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                                {t('userHistory.searchSession')}
                                            </h2>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {new Date(selectedSession.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mx-auto space-y-10 px-8 pt-8">
                                {isLoadingDetails ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                                        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                                        <p className="text-sm font-medium">{t('userHistory.loadingDetails')}</p>
                                    </div>
                                ) : (
                                    (sessionDetails || []).map((item, index) => (
                                        <div key={item.id || index} className="group animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards" style={{ animationDelay: `${index * 100}ms` }}>
                                            <div className="space-y-6">
                                                {/* Search Query */}
                                                <div className="flex justify-end pl-12">
                                                    <div className="relative max-w-[90%]">
                                                        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-5 rounded-2xl rounded-tr-sm shadow-lg shadow-blue-500/20 text-white">
                                                            <h3 className="text-lg font-medium italic">
                                                                "<HighlightMatch text={item.search_input} query={executedSearchQuery} />"
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

                                                        {item.ai_summary && (
                                                            <div className="mb-6 pb-6 border-b border-dashed border-slate-200 dark:border-slate-800">
                                                                <div className="flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-300">
                                                                    <Sparkles size={14} />
                                                                    <span className="text-xs font-bold uppercase tracking-wider">{t('userHistory.aiSummary')}</span>
                                                                </div>
                                                                <div className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                                                    <MarkdownRenderer highlightText={executedSearchQuery}>
                                                                        {item.ai_summary}
                                                                    </MarkdownRenderer>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {item.file_results?.length > 0 && (
                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                                    <FileText size={14} />
                                                                    <span className="text-xs font-bold uppercase tracking-wider">{t('userHistory.fileResults')}</span>
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    {item.file_results.map((file: any, idx: number) => (
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
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-950/50">
                        <div className="w-32 h-32 bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-full flex items-center justify-center mb-6 shadow-inner relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(59,130,246,0.3),rgba(255,255,255,0))]" />
                            <Search size={48} className="text-slate-400 dark:text-slate-500 relative z-10" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">{t('userHistory.noSessionSelected')}</h3>
                        <p className="text-slate-500 dark:text-slate-300 max-w-xs text-center">
                            {t('userHistory.selectSearchHint')}
                        </p>
                    </div>
                )}
            </div>

            {/* Filter Dialog */}
            <Dialog
                open={isFilterDialogOpen}
                onClose={() => setIsFilterDialogOpen(false)}
                title={t('userHistory.filterTitle')}
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            onClick={() => { setIsFilterDialogOpen(false); handleResetFilters(); }}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                        >
                            {t('common.reset')}
                        </button>
                        <button
                            onClick={handleApplyFilters}
                            className="px-6 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all"
                        >
                            {t('userHistory.applyFilter')}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('common.startDate')}</label>
                            <DatePicker
                                className="w-full"
                                value={tempFilters.startDate ? dayjs(tempFilters.startDate) : null}
                                onChange={(_, dateString) => setTempFilters({ ...tempFilters, startDate: dateString as string })}
                                placeholder={t('common.startDate')}
                                disabledDate={(current) => tempFilters.endDate ? current > dayjs(tempFilters.endDate) : false}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('common.endDate')}</label>
                            <DatePicker
                                className="w-full"
                                value={tempFilters.endDate ? dayjs(tempFilters.endDate) : null}
                                onChange={(_, dateString) => setTempFilters({ ...tempFilters, endDate: dateString as string })}
                                placeholder={t('common.endDate')}
                                disabledDate={(current) => tempFilters.startDate ? current < dayjs(tempFilters.startDate) : false}
                            />
                        </div>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}

/**
 * Helper component for highlighting matching text.
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

export default SearchHistoryPage;
