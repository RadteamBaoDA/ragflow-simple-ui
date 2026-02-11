/**
 * @fileoverview Hook for dashboard data fetching and date range state.
 * @module features/dashboard/hooks/useDashboardStats
 */
import { useState, useEffect, useCallback } from 'react'
import type { Dayjs } from 'dayjs'
import type { DashboardStats } from '../types/dashboard.types'
import { fetchDashboardStats } from '../api/dashboardApi'

// ============================================================================
// Return Type
// ============================================================================

/**
 * @description Return type for the useDashboardStats hook.
 */
export interface UseDashboardStatsReturn {
    /** Dashboard statistics data (null while loading initial) */
    stats: DashboardStats | null
    /** Whether data is being loaded */
    loading: boolean
    /** Current date range filter */
    dateRange: [Dayjs | null, Dayjs | null] | null
    /** Handle date range change from picker */
    handleDateRangeChange: (dates: [Dayjs | null, Dayjs | null] | null) => void
    /** Top users display limit */
    topUsersLimit: number
    /** Update top users limit */
    setTopUsersLimit: (limit: number) => void
    /** Manually refresh dashboard data */
    refresh: () => void
}

// ============================================================================
// Hook
// ============================================================================

/**
 * @description Hook for managing dashboard statistics data and filters.
 * @returns {UseDashboardStatsReturn} Dashboard state and handlers.
 */
export const useDashboardStats = (): UseDashboardStatsReturn => {
    const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [topUsersLimit, setTopUsersLimit] = useState(10)

    /**
     * Fetch dashboard data from the API.
     * Converts dayjs dates to ISO strings for the query.
     */
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const startDate = dateRange?.[0]?.format('YYYY-MM-DD') || undefined
            const endDate = dateRange?.[1]?.format('YYYY-MM-DD') || undefined
            const data = await fetchDashboardStats(startDate, endDate)
            setStats(data)
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error)
        } finally {
            setLoading(false)
        }
    }, [dateRange])

    // Load data on mount and when date range changes
    useEffect(() => {
        loadData()
    }, [loadData])

    /**
     * Handle date range change from the picker.
     * @param dates - Tuple of start and end dayjs values.
     */
    const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
        setDateRange(dates)
    }

    return {
        stats,
        loading,
        dateRange,
        handleDateRangeChange,
        topUsersLimit,
        setTopUsersLimit,
        refresh: loadData,
    }
}
