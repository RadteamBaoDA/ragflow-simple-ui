/**
 * @fileoverview API Service for Admin Histories features.
 * All types are imported from `types/histories.types.ts`.
 *
 * @module features/histories/api/historiesService
 */
import { apiFetch } from '@/lib/api'
import type {
    FilterState,
    ChatSessionSummary,
    SearchSessionSummary,
    ExternalChatHistory,
    ExternalSearchHistory,
} from '../types/histories.types'

/**
 * Fetch chat history summaries with pagination and filtering.
 * @param search - Search query for prompts/content.
 * @param filters - Filters for email, source, and date range.
 * @param page - Page number to fetch.
 * @returns List of chat sessions.
 */
export async function fetchExternalChatHistory(
    search: string,
    filters: FilterState,
    page: number,
): Promise<ChatSessionSummary[]> {
    const params = new URLSearchParams({
        q: search,
        email: filters.email,
        startDate: filters.startDate,
        endDate: filters.endDate,
        sourceName: filters.sourceName || '',
        page: page.toString(),
        limit: '20',
    })
    return apiFetch<ChatSessionSummary[]>(`/api/admin/history/chat?${params.toString()}`)
}

/**
 * Fetch search history summaries with pagination and filtering.
 * @param search - Search query.
 * @param filters - Filters.
 * @param page - Page number.
 * @returns List of search sessions.
 */
export async function fetchExternalSearchHistory(
    search: string,
    filters: FilterState,
    page: number,
): Promise<SearchSessionSummary[]> {
    const params = new URLSearchParams({
        q: search,
        email: filters.email,
        startDate: filters.startDate,
        endDate: filters.endDate,
        sourceName: filters.sourceName || '',
        page: page.toString(),
        limit: '20',
    })
    return apiFetch<SearchSessionSummary[]>(`/api/admin/history/search?${params.toString()}`)
}

/**
 * Fetch detailed messages for a specific chat session.
 * @param sessionId - ID of the session.
 * @returns List of messages in the session.
 */
export async function fetchChatSessionDetails(sessionId: string): Promise<ExternalChatHistory[]> {
    return apiFetch<ExternalChatHistory[]>(`/api/admin/history/chat/${sessionId}`)
}

/**
 * Fetch details for a specific search session.
 * @param sessionId - ID of the session.
 * @returns Details of the search session.
 */
export async function fetchSearchSessionDetails(sessionId: string): Promise<ExternalSearchHistory[]> {
    return apiFetch<ExternalSearchHistory[]>(`/api/admin/history/search/${sessionId}`)
}
