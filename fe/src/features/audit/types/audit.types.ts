/**
 * @fileoverview Type definitions for the Audit feature.
 * @module features/audit/types/audit.types
 */

/**
 * @description Audit log entry structure received from the API.
 */
export interface AuditLogEntry {
    /** Unique identifier for the log entry */
    id: number
    /** User ID who performed the action (nullable for system actions) */
    user_id: string | null
    /** Email of the user who performed the action */
    user_email: string
    /** The type of action performed (e.g., 'login', 'create_user') */
    action: string
    /** The type of resource affected (e.g., 'user', 'file') */
    resource_type: string
    /** ID of the affected resource */
    resource_id: string | null
    /** Additional details about the action (JSON object) */
    details: Record<string, any>
    /** IP address from where the action originated */
    ip_address: string | null
    /** Timestamp of the action */
    created_at: string
}

/**
 * @description Pagination metadata returned by the API.
 */
export interface AuditPagination {
    /** Current page number */
    page: number
    /** Number of items per page */
    limit: number
    /** Total number of items available */
    total: number
    /** Total number of pages */
    totalPages: number
}

/**
 * @description The shape of the API response for audit logs.
 */
export interface AuditLogResponse {
    /** List of audit log entries */
    data: AuditLogEntry[]
    /** Pagination information */
    pagination: AuditPagination
}

/**
 * @description State for filtering the audit logs.
 */
export interface AuditFilters {
    /** Search term for filtering by text */
    search: string
    /** Filter by specific action type */
    action: string
    /** Filter by specific resource type */
    resourceType: string
    /** Start date for time range filtering */
    startDate: string
    /** End date for time range filtering */
    endDate: string
}

/** Default empty filter state */
export const DEFAULT_AUDIT_FILTERS: AuditFilters = {
    search: '',
    action: '',
    resourceType: '',
    startDate: '',
    endDate: '',
}
