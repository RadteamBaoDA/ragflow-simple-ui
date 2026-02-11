/**
 * @fileoverview API service for Dashboard statistics.
 * @module features/dashboard/api/dashboardApi
 */
import { apiFetch } from '@/lib/api'
import type { DashboardStats } from '../types/dashboard.types'

/**
 * Fetch dashboard statistics from the API.
 * @param startDate - Optional ISO date string for range start.
 * @param endDate - Optional ISO date string for range end.
 * @returns Dashboard statistics payload.
 */
export async function fetchDashboardStats(
    startDate?: string,
    endDate?: string
): Promise<DashboardStats> {
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)

    const queryString = params.toString()
    const url = `/api/admin/dashboard/stats${queryString ? `?${queryString}` : ''}`

    return apiFetch<DashboardStats>(url)
}
