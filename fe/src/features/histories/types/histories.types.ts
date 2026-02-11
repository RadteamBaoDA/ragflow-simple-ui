/**
 * @fileoverview Type definitions for the Histories (admin) feature.
 * @module features/histories/types/histories.types
 */

/**
 * Filter state for admin history queries.
 * Includes email and sourceName fields not present in user-level history.
 */
export interface FilterState {
    /** Filter by user email. */
    email: string
    /** Filter start date (ISO string). */
    startDate: string
    /** Filter end date (ISO string). */
    endDate: string
    /** Filter by source/knowledge base name. */
    sourceName?: string
}

/**
 * Summary of a chat session, used for the admin list view.
 */
export interface ChatSessionSummary {
    /** Unique session identifier. */
    session_id: string
    /** User email if authenticated, otherwise undefined/null. */
    user_email?: string
    /** First prompt of the session, used as title. */
    user_prompt: string
    /** Timestamp of the latest activity in the session. */
    created_at: string
    /** Total number of messages in the session. */
    message_count: string | number
    /** Source name if available. */
    source_name?: string
}

/**
 * Summary of a search session, used for the admin list view.
 */
export interface SearchSessionSummary {
    /** Unique session identifier. */
    session_id: string
    /** User email if authenticated. */
    user_email?: string
    /** The search query. */
    search_input: string
    /** Timestamp of the search. */
    created_at: string
    /** Number of related activities/messages. */
    message_count: string | number
    /** Source name if available. */
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

/** Active tab type for the histories page. */
export type HistoriesTab = 'chat' | 'search'
