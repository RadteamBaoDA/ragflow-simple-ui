/**
 * @fileoverview API Service for Admin Histories features.
 */
import { apiFetch } from '@/lib/api';

/**
 * Filter state for history queries.
 */
export interface FilterState {
    email: string;
    startDate: string;
    endDate: string;
    sourceName: string;
}

/**
 * Summary of a chat session, used for the list view.
 */
export interface ChatSessionSummary {
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
    /** Source name if available */
    source_name?: string;
}

/**
 * Summary of a search session, used for the list view.
 */
export interface SearchSessionSummary {
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
    /** Source name if available */
    source_name?: string;
}

/**
 * Detailed chat history record.
 */
export interface ExternalChatHistory {
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
export interface ExternalSearchHistory {
    id: string;
    session_id: string;
    user_email?: string;
    search_input: string;
    ai_summary: string;
    file_results: any[];
    created_at: string;
}

/**
 * Fetch chat history summaries with pagination and filtering.
 */
export async function fetchExternalChatHistory(search: string, filters: FilterState, page: number): Promise<ChatSessionSummary[]> {
    const params = new URLSearchParams({
        q: search,
        email: filters.email,
        startDate: filters.startDate,
        endDate: filters.endDate,
        sourceName: filters.sourceName,
        page: page.toString(),
        limit: '20'
    });
    return apiFetch<ChatSessionSummary[]>(`/api/admin/history/chat?${params.toString()}`);
}

/**
 * Fetch search history summaries with pagination and filtering.
 */
export async function fetchExternalSearchHistory(search: string, filters: FilterState, page: number): Promise<SearchSessionSummary[]> {
    const params = new URLSearchParams({
        q: search,
        email: filters.email,
        startDate: filters.startDate,
        endDate: filters.endDate,
        sourceName: filters.sourceName,
        page: page.toString(),
        limit: '20'
    });
    return apiFetch<SearchSessionSummary[]>(`/api/admin/history/search?${params.toString()}`);
}

/**
 * Fetch detailed messages for a specific chat session.
 */
export async function fetchChatSessionDetails(sessionId: string): Promise<ExternalChatHistory[]> {
    return apiFetch<ExternalChatHistory[]>(`/api/admin/history/chat/${sessionId}`);
}

/**
 * Fetch details for a specific search session.
 */
export async function fetchSearchSessionDetails(sessionId: string): Promise<ExternalSearchHistory[]> {
    return apiFetch<ExternalSearchHistory[]>(`/api/admin/history/search/${sessionId}`);
}
