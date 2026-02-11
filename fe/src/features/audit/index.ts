/**
 * @fileoverview Barrel file for the audit feature.
 * Exports page component and types for external consumption.
 * @module features/audit
 */

// Page
export { default as AuditLogPage } from './pages/AuditLogPage'

// Types
export type {
    AuditLogEntry,
    AuditPagination,
    AuditLogResponse,
    AuditFilters,
} from './types/audit.types'

// API (for potential reuse in other features)
export { auditApi } from './api/auditApi'
