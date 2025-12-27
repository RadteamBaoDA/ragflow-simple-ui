/**
 * @fileoverview API Service for History features.
 */
import { apiFetch } from '@/lib/api';

/**
 * Filter state for history queries.
 */
export interface FilterState {
    startDate: string;
    endDate: string;
}

/**
 * Summary of a chat session.
 */
export interface ChatSessionSummary {
    session_id: string;
    user_email?: string;
    user_prompt: string;
    created_at: string;
    message_count: string | number;
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
 * Summary of a search session.
 */
export interface SearchSessionSummary {
    session_id: string;
    user_email?: string;
    search_input: string;
    created_at: string;
    message_count: string | number;
    source_name?: string;
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
 * Fetch user's chat history with pagination and filtering.
 */
export async function fetchChatHistory(search: string, filters: FilterState, page: number): Promise<ChatSessionSummary[]> {
    const params = new URLSearchParams({
        q: search,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: page.toString(),
        limit: '20'
    });
    return apiFetch<ChatSessionSummary[]>(`/api/user/history/chat?${params.toString()}`);
}

/**
 * Fetch detailed messages for a specific chat session.
 */
export async function fetchChatSessionDetails(sessionId: string): Promise<ExternalChatHistory[]> {
    return apiFetch<ExternalChatHistory[]>(`/api/user/history/chat/${sessionId}`);
}

/**
 * Fetch user's search history with pagination and filtering.
 */
export async function fetchSearchHistory(search: string, filters: FilterState, page: number): Promise<SearchSessionSummary[]> {
    const params = new URLSearchParams({
        q: search,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: page.toString(),
        limit: '20'
    });
    return apiFetch<SearchSessionSummary[]>(`/api/user/history/search?${params.toString()}`);
}

/**
 * Fetch details for a specific search session.
 */
export async function fetchSearchSessionDetails(sessionId: string): Promise<ExternalSearchHistory[]> {
    return apiFetch<ExternalSearchHistory[]>(`/api/user/history/search/${sessionId}`);
}
