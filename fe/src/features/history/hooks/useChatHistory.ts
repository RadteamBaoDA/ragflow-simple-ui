/**
 * @fileoverview Hook for chat history data fetching and session management.
 * Encapsulates infinite scrolling, session detail fetching, and refresh logic.
 *
 * @module features/history/hooks/useChatHistory
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import {
    type ChatSessionSummary,
    type ExternalChatHistory,
    type FilterState,
    fetchChatHistory,
    fetchChatSessionDetails,
} from '../api/historyService'

/**
 * Return type for the useChatHistory hook.
 * @description Exposes session list, details, selection, and infinite scroll state.
 */
export interface UseChatHistoryReturn {
    /** Flattened list of all loaded chat session summaries. */
    flattenedData: ChatSessionSummary[]
    /** Currently selected session. */
    selectedSession: ChatSessionSummary | null
    /** Set the selected session. */
    setSelectedSession: (session: ChatSessionSummary | null) => void
    /** Whether the session list is loading (initial load). */
    isLoading: boolean
    /** Whether new pages are being fetched. */
    isFetchingNextPage: boolean
    /** Ref to attach to the "load more" sentinel element. */
    loadMoreRef: React.RefObject<HTMLDivElement | null>
    /** Detailed messages for the selected session. */
    sessionDetails: ExternalChatHistory[] | undefined
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
 * Hook for managing chat history data and state.
 * @param executedSearchQuery - Currently active search query.
 * @param filters - Currently active date filters.
 * @returns Chat history state and handlers.
 */
export const useChatHistory = (executedSearchQuery: string, filters: FilterState): UseChatHistoryReturn => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [selectedSession, setSelectedSession] = useState<ChatSessionSummary | null>(null)
    const loadMoreRef = useRef<HTMLDivElement>(null)

    // Fetch chat history with infinite scrolling
    const {
        data: chatData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        refetch,
        isRefetching,
    } = useInfiniteQuery({
        queryKey: ['userChatHistory', executedSearchQuery, filters],
        queryFn: ({ pageParam = 1 }) => fetchChatHistory(executedSearchQuery, filters, pageParam),
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
    } = useQuery<ExternalChatHistory[]>({
        queryKey: ['chatSessionDetails', selectedSession?.session_id],
        queryFn: async () => {
            if (!selectedSession?.session_id) return []
            return fetchChatSessionDetails(selectedSession.session_id)
        },
        enabled: !!selectedSession?.session_id,
    })

    // Flatten paginated data
    const flattenedData = useMemo(() => {
        return chatData?.pages?.flat() || []
    }, [chatData])

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
