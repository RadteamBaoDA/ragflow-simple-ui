/**
 * @fileoverview Type definitions for the Dashboard feature.
 * @module features/dashboard/types/dashboard.types
 */

/**
 * Daily activity data point for trend charts.
 */
export interface DailyActivity {
    /** Date string (YYYY-MM-DD) */
    date: string
    /** External chat message count */
    chatCount: number
    /** External search record count */
    searchCount: number
}

/**
 * Top user entry with session count.
 */
export interface TopUser {
    /** User email address */
    email: string
    /** Total session count across all sources */
    sessionCount: number
}

/**
 * Session count breakdown by source type.
 */
export interface UsageBreakdown {
    /** External AI Chat sessions */
    chatSessions: number
    /** External AI Search sessions */
    searchSessions: number
}

/**
 * Complete dashboard statistics payload from the API.
 */
export interface DashboardStats {
    /** Total sessions across all sources */
    totalSessions: number
    /** Total messages across all sources */
    totalMessages: number
    /** Count of unique users */
    uniqueUsers: number
    /** Average messages per session */
    avgMessagesPerSession: number
    /** Daily activity trend data */
    activityTrend: DailyActivity[]
    /** Top 10 most active users */
    topUsers: TopUser[]
    /** Session breakdown by type */
    usageBreakdown: UsageBreakdown
}
