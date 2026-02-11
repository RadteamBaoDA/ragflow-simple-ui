/**
 * @fileoverview API Service for History features.
 * Centralizes all history-related API calls, types, and data fetching.
 *
 * @module features/history/api/historyService
 */
import { apiFetch } from '@/lib/api'

// ============================================================================
// Shared Types
// ============================================================================

/**
 * Filter state for history queries.
 */
export interface FilterState {
    startDate: string
    endDate: string
}

// ============================================================================
// Chat History Types
// ============================================================================

/**
 * Summary of a chat session.
 */
export interface ChatSessionSummary {
    session_id: string
    user_email?: string
    user_prompt: string
    created_at: string
    message_count: string | number
    source_name?: string
}

/**
 * Detailed chat history record.
 */
export interface ExternalChatHistory {
    id: string
    session_id: string
    user_email?: string
    user_prompt: string
    llm_response: string
    citations: any[]
    created_at: string
}

// ============================================================================
// Search History Types
// ============================================================================

/**
 * Summary of a search session.
 */
export interface SearchSessionSummary {
    session_id: string
    user_email?: string
    search_input: string
    created_at: string
    message_count: string | number
    source_name?: string
}

/**
 * Detailed search history record.
 */
export interface ExternalSearchHistory {
    id: string
    session_id: string
    user_email?: string
    search_input: string
    ai_summary: string
    file_results: any[]
    created_at: string
}

// ============================================================================
// Internal History Types (HistoryPage)
// ============================================================================

/** Chat session with messages. */
export interface ChatSession {
    /** Unique session identifier. */
    id: string
    /** Session title (usually first message summary). */
    title: string
    /** ISO timestamp when session was created. */
    createdAt: string
    /** ISO timestamp when session was last updated. */
    updatedAt: string
    /** Array of messages in the session. */
    messages: Array<{
        id: string
        role: 'user' | 'assistant'
        content: string
        timestamp: string
    }>
}

/** Search results with pagination info. */
export interface SearchResult {
    sessions: ChatSession[]
    total: number
}

/** Search query parameters. */
export interface SearchParams {
    q?: string | undefined
    startDate?: string | undefined
    endDate?: string | undefined
    limit?: number | undefined
    offset?: number | undefined
}

// ============================================================================
// User History API (ChatHistoryPage / SearchHistoryPage)
// ============================================================================

/**
 * Fetch user's chat history with pagination and filtering.
 * @param search - Search query string.
 * @param filters - Date range filter state.
 * @param page - Page number (1-indexed).
 * @returns Array of chat session summaries.
 */
export async function fetchChatHistory(search: string, filters: FilterState, page: number): Promise<ChatSessionSummary[]> {
    const params = new URLSearchParams({
        q: search,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: page.toString(),
        limit: '20'
    })
    return apiFetch<ChatSessionSummary[]>(`/api/user/history/chat?${params.toString()}`)
}

/**
 * Fetch detailed messages for a specific chat session.
 * @param sessionId - The session ID to fetch details for.
 * @returns Array of detailed chat history records.
 */
export async function fetchChatSessionDetails(sessionId: string): Promise<ExternalChatHistory[]> {
    return apiFetch<ExternalChatHistory[]>(`/api/user/history/chat/${sessionId}`)
}

/**
 * Fetch user's search history with pagination and filtering.
 * @param search - Search query string.
 * @param filters - Date range filter state.
 * @param page - Page number (1-indexed).
 * @returns Array of search session summaries.
 */
export async function fetchSearchHistory(search: string, filters: FilterState, page: number): Promise<SearchSessionSummary[]> {
    const params = new URLSearchParams({
        q: search,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: page.toString(),
        limit: '20'
    })
    return apiFetch<SearchSessionSummary[]>(`/api/user/history/search?${params.toString()}`)
}

/**
 * Fetch details for a specific search session.
 * @param sessionId - The session ID to fetch details for.
 * @returns Array of detailed search history records.
 */
export async function fetchSearchSessionDetails(sessionId: string): Promise<ExternalSearchHistory[]> {
    return apiFetch<ExternalSearchHistory[]>(`/api/user/history/search/${sessionId}`)
}

// ============================================================================
// Internal History API (HistoryPage)
// ============================================================================

/**
 * Search chat sessions with filters.
 * @param params - Search parameters (query, dates, pagination).
 * @returns Search results with sessions and total count.
 */
export async function searchChatSessions(params: SearchParams): Promise<SearchResult> {
    const searchParams = new URLSearchParams()
    if (params.q) searchParams.set('q', params.q)
    if (params.startDate) searchParams.set('startDate', params.startDate)
    if (params.endDate) searchParams.set('endDate', params.endDate)
    if (params.limit) searchParams.set('limit', params.limit.toString())
    if (params.offset) searchParams.set('offset', params.offset.toString())

    return apiFetch<SearchResult>(`/api/chat/sessions/search?${searchParams.toString()}`)
}

/**
 * Delete a single chat session.
 * @param sessionId - ID of session to delete.
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
    await apiFetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
    })
}

/**
 * Delete multiple chat sessions.
 * @param sessionIds - Array of session IDs to delete.
 * @returns Count of deleted sessions.
 */
export async function deleteChatSessions(sessionIds: string[]): Promise<{ deleted: number }> {
    return apiFetch<{ deleted: number }>('/api/chat/sessions', {
        method: 'DELETE',
        body: JSON.stringify({ sessionIds }),
    })
}

/**
 * Delete all sessions for the current user.
 * @returns Count of deleted sessions.
 */
export async function deleteAllSessions(): Promise<{ deleted: number }> {
    return apiFetch<{ deleted: number }>('/api/chat/sessions', {
        method: 'DELETE',
        body: JSON.stringify({ all: true }),
    })
}
