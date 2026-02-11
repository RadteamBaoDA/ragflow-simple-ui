/**
 * @fileoverview Hook for audit log data fetching and pagination.
 * Encapsulates log listing, filter option loading, debounced search,
 * and pagination handling.
 * @module features/audit/hooks/useAuditLogs
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { AuditLogEntry, AuditPagination } from '../types/audit.types'
import { auditApi } from '../api/auditApi'
import { useAuditFilters } from '../contexts/AuditFilterContext'

// ============================================================================
// Return Type
// ============================================================================

/**
 * @description Return type for the useAuditLogs hook.
 */
export interface UseAuditLogsReturn {
    /** Current page of audit log entries */
    logs: AuditLogEntry[]
    /** Current pagination state */
    pagination: AuditPagination
    /** Whether data is being loaded */
    isLoading: boolean
    /** Available action types for filter dropdown */
    actionTypes: string[]
    /** Available resource types for filter dropdown */
    resourceTypes: string[]
    /** Handle page or page-size change */
    handlePageChange: (page: number, pageSize?: number) => void
    /** Refresh current page data */
    refresh: () => void
}

// ============================================================================
// Hook
// ============================================================================

/**
 * @description Hook for managing audit log data, pagination, and filter options.
 * Reads filter state from AuditFilterContext and triggers debounced fetches.
 *
 * @returns {UseAuditLogsReturn} Audit log state and handlers.
 */
export const useAuditLogs = (): UseAuditLogsReturn => {
    const { t } = useTranslation()
    const { filters } = useAuditFilters()

    // Data state
    const [logs, setLogs] = useState<AuditLogEntry[]>([])
    const [pagination, setPagination] = useState<AuditPagination>({
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
    })
    const [isLoading, setIsLoading] = useState(true)

    // Filter options from backend
    const [actionTypes, setActionTypes] = useState<string[]>([])
    const [resourceTypes, setResourceTypes] = useState<string[]>([])

    /**
     * Fetch audit logs for a specific page and limit.
     * @param page - Page number.
     * @param limit - Items per page (optional, defaults to current).
     */
    const fetchLogs = useCallback(async (page: number = 1, limit?: number) => {
        setIsLoading(true)
        try {
            const fetchLimit = limit || pagination.limit
            const data = await auditApi.fetchLogs(page, fetchLimit, filters)
            setLogs(data.data)
            setPagination(data.pagination)
        } catch (err) {
            console.error('Failed to fetch audit logs:', err)
        } finally {
            setIsLoading(false)
        }
    }, [filters, pagination.limit, t])

    /**
     * Fetch filter dropdown options (action types + resource types).
     */
    const fetchFilterOptions = useCallback(async () => {
        try {
            const [actions, types] = await Promise.all([
                auditApi.fetchActions(),
                auditApi.fetchResourceTypes(),
            ])
            setActionTypes(actions)
            setResourceTypes(types)
        } catch (err) {
            console.error('Failed to fetch filter options:', err)
        }
    }, [])

    // Initial data fetch on mount
    useEffect(() => {
        fetchLogs(1)
        fetchFilterOptions()
    }, [])

    // Debounced re-fetch when filters change
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLogs(1)
        }, 300)
        return () => clearTimeout(timer)
    }, [filters])

    /**
     * Handle page or page-size change from pagination control.
     * @param newPage - New page number.
     * @param newPageSize - New page size (triggers reset to page 1).
     */
    const handlePageChange = (newPage: number, newPageSize?: number) => {
        if (newPageSize && newPageSize !== pagination.limit) {
            fetchLogs(1, newPageSize)
        } else {
            fetchLogs(newPage)
        }
    }

    /** Refresh current page data */
    const refresh = () => fetchLogs(pagination.page)

    return {
        logs,
        pagination,
        isLoading,
        actionTypes,
        resourceTypes,
        handlePageChange,
        refresh,
    }
}
