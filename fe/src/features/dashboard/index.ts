/**
 * @fileoverview Barrel file for the dashboard feature.
 * Exports page component, types, and API for external consumption.
 * @module features/dashboard
 */

// Page
export { default as AdminDashboardPage } from './pages/AdminDashboardPage'

// Types
export type {
    DailyActivity,
    TopUser,
    UsageBreakdown,
    DashboardStats,
} from './types/dashboard.types'

// API
export { fetchDashboardStats } from './api/dashboardApi'
