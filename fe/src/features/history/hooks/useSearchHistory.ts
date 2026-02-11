/**
 * @fileoverview Hook for search history data fetching and session management.
 * Encapsulates infinite scrolling, session detail fetching, and refresh logic.
 *
 * @module features/history/hooks/useSearchHistory
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import {
    type SearchSessionSummary,
    type ExternalSearchHistory,
    type FilterState,
    fetchSearchHistory,
    fetchSearchSessionDetails,
} from '../api/historyService'

/**
 * Return type for the useSearchHistory hook.
 * @description Exposes session list, details, selection, and infinite scroll state.
 */
export interface UseSearchHistoryReturn {
    /** Flattened list of all loaded search session summaries. */
    flattenedData: SearchSessionSummary[]
    /** Currently selected session. */
    selectedSession: SearchSessionSummary | null
    /** Set the selected session. */
    setSelectedSession: (session: SearchSessionSummary | null) => void
    /** Whether the session list is loading (initial load). */
    isLoading: boolean
    /** Whether new pages are being fetched. */
    isFetchingNextPage: boolean
    /** Ref to attach to the "load more" sentinel element. */
    loadMoreRef: React.RefObject<HTMLDivElement | null>
    /** Detailed records for the selected session. */
    sessionDetails: ExternalSearchHistory[] | undefined
    /** Whether session details are loading. */
    isLoadingDetails: boolean
    /** Whether data is being refreshed. */
    isRefreshing: boolean
    /** Refresh all data. */
    handleRefresh: () => void
    /** Sidebar open state. */
    isSidebarOpen: boolean
    /** Toggle sidebar. */
    setIsSidebarOpen: (open: boolean) => void
}

/**
 * Hook for managing search history data and state.
 * @param executedSearchQuery - Currently active search query.
 * @param filters - Currently active date filters.
 * @returns Search history state and handlers.
 */
export const useSearchHistory = (executedSearchQuery: string, filters: FilterState): UseSearchHistoryReturn => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [selectedSession, setSelectedSession] = useState<SearchSessionSummary | null>(null)
    const loadMoreRef = useRef<HTMLDivElement>(null)

    // Fetch search history with infinite scrolling
    const {
        data: searchData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        refetch,
        isRefetching,
    } = useInfiniteQuery({
        queryKey: ['userSearchHistory', executedSearchQuery, filters],
        queryFn: ({ pageParam = 1 }) => fetchSearchHistory(executedSearchQuery, filters, pageParam),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === 20 ? allPages.length + 1 : undefined
        },
        // Force refetch when navigating back to this page to get latest data
        refetchOnMount: 'always',
    })

    // Fetch session details when a session is selected
    const {
        data: sessionDetails,
        isLoading: isLoadingDetails,
        refetch: refetchDetails,
        isRefetching: isRefetchingDetails,
    } = useQuery<ExternalSearchHistory[]>({
        queryKey: ['searchSessionDetails', selectedSession?.session_id],
        queryFn: async () => {
            if (!selectedSession?.session_id) return []
            return fetchSearchSessionDetails(selectedSession.session_id)
        },
        enabled: !!selectedSession?.session_id,
    })

    // Flatten paginated data
    const flattenedData = useMemo(() => {
        return searchData?.pages?.flat() || []
    }, [searchData])

    // Infinite scroll observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage()
                }
            },
            { threshold: 0.1 }
        )

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current)
        }

        return () => observer.disconnect()
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    // Auto-select first item when data loads
    useEffect(() => {
        if (!selectedSession && flattenedData.length > 0) {
            setSelectedSession(flattenedData[0] ?? null)
        }
    }, [flattenedData, selectedSession])

    // Clear selection when search query changes
    useEffect(() => {
        setSelectedSession(null)
    }, [executedSearchQuery])

    /**
     * Refresh all data.
     */
    const handleRefresh = () => {
        refetch()
        if (selectedSession) refetchDetails()
    }

    const isRefreshing = isRefetching || isRefetchingDetails

    return {
        flattenedData,
        selectedSession,
        setSelectedSession,
        isLoading,
        isFetchingNextPage,
        loadMoreRef,
        sessionDetails,
        isLoadingDetails,
        isRefreshing,
        handleRefresh,
        isSidebarOpen,
        setIsSidebarOpen,
    }
}
