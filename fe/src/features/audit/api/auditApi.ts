/**
 * @fileoverview API service for the Audit feature.
 * Centralizes all audit-related API calls using the shared apiFetch utility.
 * @module features/audit/api/auditApi
 */
import { apiFetch } from '@/lib/api'
import type { AuditLogEntry, AuditPagination, AuditFilters } from '../types/audit.types'

// ============================================================================
// API Response Types (internal)
// ============================================================================

/** Raw API response shape for audit log listing */
interface AuditLogApiResponse {
    data: AuditLogEntry[]
    pagination: AuditPagination
}

// ============================================================================
// API Service
// ============================================================================

export const auditApi = {
    /**
     * Fetch audit logs with pagination and filters.
     * @param page - Page number (1-indexed).
     * @param limit - Items per page.
     * @param filters - Active filter state.
     * @returns Paginated audit log entries.
     */
    fetchLogs: async (
        page: number,
        limit: number,
        filters: AuditFilters
    ): Promise<AuditLogApiResponse> => {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
        })

        if (filters.search) params.append('search', filters.search)
        if (filters.action) params.append('action', filters.action)
        if (filters.resourceType) params.append('resourceType', filters.resourceType)
        if (filters.startDate) params.append('startDate', filters.startDate)
        if (filters.endDate) params.append('endDate', filters.endDate)

        return apiFetch<AuditLogApiResponse>(`/api/audit?${params}`)
    },

    /**
     * Fetch all available action types for filter dropdown.
     * @returns Array of action type strings.
     */
    fetchActions: async (): Promise<string[]> => {
        return apiFetch<string[]>('/api/audit/actions')
    },

    /**
     * Fetch all available resource types for filter dropdown.
     * @returns Array of resource type strings.
     */
    fetchResourceTypes: async (): Promise<string[]> => {
        return apiFetch<string[]>('/api/audit/resource-types')
    },
}
