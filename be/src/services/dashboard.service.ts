
/**
 * Dashboard Service
 * Provides aggregate statistics for admin activity dashboard.
 * Queries across external chat and external search data sources.
 * @module services/dashboard
 */
import { db } from '@/db/knex.js'

/**
 * Shape of daily activity data point for trend charts.
 */
export interface DailyActivity {
  /** Date string (YYYY-MM-DD) */
  date: string
  /** Number of external chat messages on this date */
  chatCount: number
  /** Number of external search records on this date */
  searchCount: number
}

/**
 * Shape of a top user entry.
 */
export interface TopUser {
  /** User email address */
  email: string
  /** Total session count across all sources */
  sessionCount: number
}

/**
 * Usage breakdown by source type.
 */
export interface UsageBreakdown {
  /** External AI Chat session count */
  chatSessions: number
  /** External AI Search session count */
  searchSessions: number
}

/**
 * Complete dashboard statistics payload.
 */
export interface DashboardStats {
  /** Summary card numbers */
  totalSessions: number
  totalMessages: number
  uniqueUsers: number
  avgMessagesPerSession: number
  /** Daily activity trend for line/column charts */
  activityTrend: DailyActivity[]
  /** Top 10 most active users */
  topUsers: TopUser[]
  /** Session breakdown by type for pie chart */
  usageBreakdown: UsageBreakdown
}

/**
 * DashboardService aggregates statistics from external chat and search sources.
 * Uses parallel Knex queries for performance.
 */
class DashboardService {
  /**
   * Get comprehensive dashboard statistics.
   * @param startDate - Optional ISO date string for range start
   * @param endDate - Optional ISO date string for range end
   * @returns Promise<DashboardStats> - All dashboard data in a single payload
   */
  async getStats(startDate?: string, endDate?: string): Promise<DashboardStats> {
    // Run all queries in parallel for performance
    const [
      chatSessionCount,
      searchSessionCount,
      chatMessageCount,
      searchRecordCount,
      chatUserEmails,
      searchUserEmails,
      chatTrend,
      searchTrend,
      topUsers
    ] = await Promise.all([
      // Session counts
      this.countRows('external_chat_sessions', 'updated_at', startDate, endDate),
      this.countRows('external_search_sessions', 'updated_at', startDate, endDate),
      // Message counts
      this.countRows('external_chat_messages', 'created_at', startDate, endDate),
      this.countRows('external_search_records', 'created_at', startDate, endDate),
      // Unique users
      this.getDistinctEmails('external_chat_sessions', 'user_email', 'updated_at', startDate, endDate),
      this.getDistinctEmails('external_search_sessions', 'user_email', 'updated_at', startDate, endDate),
      // Daily trends (separate per source)
      this.getDailyCount('external_chat_messages', 'created_at', startDate, endDate),
      this.getDailyCount('external_search_records', 'created_at', startDate, endDate),
      // Top users
      this.getTopUsers(startDate, endDate)
    ])

    // Calculate derived metrics
    const totalSessions = chatSessionCount + searchSessionCount
    const totalMessages = chatMessageCount + searchRecordCount

    // Merge unique users from all sources
    const allEmails = new Set<string>([...chatUserEmails, ...searchUserEmails])
    const uniqueUsers = allEmails.size

    // Average messages per session (avoid division by zero)
    const avgMessagesPerSession = totalSessions > 0
      ? Math.round((totalMessages / totalSessions) * 10) / 10
      : 0

    // Merge daily trends from both sources into a single array
    const activityTrend = this.mergeTrends(chatTrend, searchTrend)

    return {
      totalSessions,
      totalMessages,
      uniqueUsers,
      avgMessagesPerSession,
      activityTrend,
      topUsers,
      usageBreakdown: {
        chatSessions: chatSessionCount,
        searchSessions: searchSessionCount
      }
    }
  }

  /**
   * Count rows in a table with optional date filter.
   * @param table - Table name
   * @param dateCol - Date column for filtering
   * @param startDate - Optional start date
   * @param endDate - Optional end date
   * @returns Row count
   */
  private async countRows(table: string, dateCol: string, startDate?: string, endDate?: string): Promise<number> {
    // Build query with optional date range
    let query = db(table).count('* as count')
    if (startDate) query = query.where(dateCol, '>=', startDate)
    if (endDate) query = query.where(dateCol, '<=', `${endDate} 23:59:59`)
    const result = await query.first()
    return parseInt(result?.count as string || '0', 10)
  }

  /**
   * Get distinct emails from an external session table.
   * @param table - Table name
   * @param emailCol - Column containing email
   * @param dateCol - Date column for filtering
   * @param startDate - Optional start date
   * @param endDate - Optional end date
   * @returns Array of unique email strings
   */
  private async getDistinctEmails(
    table: string, emailCol: string, dateCol: string,
    startDate?: string, endDate?: string
  ): Promise<string[]> {
    // Query distinct non-null, non-empty emails
    let query = db(table).distinct(emailCol).whereNotNull(emailCol).where(emailCol, '!=', '')
    if (startDate) query = query.where(dateCol, '>=', startDate)
    if (endDate) query = query.where(dateCol, '<=', `${endDate} 23:59:59`)
    const rows = await query
    return rows.map((r: any) => r[emailCol] as string)
  }

  /**
   * Get daily message/record counts from a table.
   * @param table - Table name
   * @param dateCol - Timestamp column
   * @param startDate - Optional start date
   * @param endDate - Optional end date
   * @returns Map of date string -> count
   */
  private async getDailyCount(
    table: string, dateCol: string,
    startDate?: string, endDate?: string
  ): Promise<Map<string, number>> {
    // Group by day, count records per day
    let query = db(table)
      .select(db.raw(`date_trunc('day', ${dateCol})::date as date`))
      .count('* as count')
      .groupByRaw(`date_trunc('day', ${dateCol})::date`)
      .orderBy('date', 'asc')
    if (startDate) query = query.where(dateCol, '>=', startDate)
    if (endDate) query = query.where(dateCol, '<=', `${endDate} 23:59:59`)

    const rows = await query
    const map = new Map<string, number>()
    rows.forEach((r: any) => {
      // Normalize date to YYYY-MM-DD string
      const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date)
      map.set(dateStr, parseInt(r.count as string || '0', 10))
    })
    return map
  }

  /**
   * Merge daily trends from two sources into a single array.
   * @param chat - Chat daily counts
   * @param search - Search daily counts
   * @returns Sorted array of DailyActivity
   */
  private mergeTrends(
    chat: Map<string, number>,
    search: Map<string, number>
  ): DailyActivity[] {
    // Collect all unique dates from both sources
    const allDates = new Set<string>([...chat.keys(), ...search.keys()])

    // Build merged activity array
    const result: DailyActivity[] = []
    allDates.forEach(date => {
      result.push({
        date,
        chatCount: chat.get(date) || 0,
        searchCount: search.get(date) || 0
      })
    })

    // Sort by date ascending
    result.sort((a, b) => a.date.localeCompare(b.date))
    return result
  }

  /**
   * Get the top 10 most active users by session count across all sources.
   * @param startDate - Optional start date
   * @param endDate - Optional end date
   * @returns Array of top user objects sorted descending by session count
   */
  private async getTopUsers(startDate?: string, endDate?: string): Promise<TopUser[]> {
    // Build separate queries for each source, then combine with raw SQL
    // External chat sessions
    const chatQ = db('external_chat_sessions')
      .select('user_email as email')
      .count('* as cnt')
      .whereNotNull('user_email')
      .where('user_email', '!=', '')
      .modify(qb => {
        if (startDate) qb.where('updated_at', '>=', startDate)
        if (endDate) qb.where('updated_at', '<=', `${endDate} 23:59:59`)
      })
      .groupBy('user_email')

    // External search sessions
    const searchQ = db('external_search_sessions')
      .select('user_email as email')
      .count('* as cnt')
      .whereNotNull('user_email')
      .where('user_email', '!=', '')
      .modify(qb => {
        if (startDate) qb.where('updated_at', '>=', startDate)
        if (endDate) qb.where('updated_at', '<=', `${endDate} 23:59:59`)
      })
      .groupBy('user_email')

    // Use UNION ALL to combine both sources, then aggregate by email
    const result = await db.raw(`
      SELECT email, SUM(cnt)::int as "sessionCount"
      FROM (
        (${chatQ.toQuery()})
        UNION ALL
        (${searchQ.toQuery()})
      ) combined
      GROUP BY email
      ORDER BY "sessionCount" DESC
      LIMIT 50
    `)

    return result.rows.map((row: any) => ({
      email: row.email,
      sessionCount: row.sessionCount || 0
    }))
  }
}

/** Singleton dashboard service instance */
export const dashboardService = new DashboardService()
