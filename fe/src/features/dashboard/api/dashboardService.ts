/**
 * @fileoverview API Service for Admin Dashboard statistics.
 * @description Provides typed interfaces and fetch function for dashboard data.
 */
import { apiFetch } from '@/lib/api'

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

/**
 * Fetch dashboard statistics from the API.
 * @param startDate - Optional ISO date string for range start
 * @param endDate - Optional ISO date string for range end
 * @returns Promise<DashboardStats> - Dashboard data
 */
export async function fetchDashboardStats(
  startDate?: string,
  endDate?: string
): Promise<DashboardStats> {
  // Build query params, only include non-empty values
  const params = new URLSearchParams()
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)

  const queryString = params.toString()
  const url = `/api/admin/dashboard/stats${queryString ? `?${queryString}` : ''}`

  return apiFetch<DashboardStats>(url)
}
