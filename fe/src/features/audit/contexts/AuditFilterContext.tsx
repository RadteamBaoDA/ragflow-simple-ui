/**
 * @fileoverview React Context for audit filter state.
 * Provides filter values and handlers to all audit components,
 * eliminating prop-drilling between toolbar and filter panel.
 * @module features/audit/contexts/AuditFilterContext
 */
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import { type AuditFilters, DEFAULT_AUDIT_FILTERS } from '../types/audit.types'

// ============================================================================
// Context Shape
// ============================================================================

/**
 * @description Shape of the audit filter context value.
 */
interface AuditFilterContextValue {
    /** Current filter state */
    filters: AuditFilters
    /** Update a single filter field */
    setFilter: (key: keyof AuditFilters, value: string) => void
    /** Reset all filters to defaults */
    clearFilters: () => void
    /** Whether the filter panel is visible */
    showFilters: boolean
    /** Toggle filter panel visibility */
    toggleFilters: () => void
    /** Whether any filter has a non-empty value */
    hasActiveFilters: boolean
}

// ============================================================================
// Context + Provider
// ============================================================================

const AuditFilterContext = createContext<AuditFilterContextValue | null>(null)

/**
 * @description Provider component for audit filter state.
 * Wrap around any subtree that needs access to filter controls.
 *
 * @param {object} props
 * @param {ReactNode} props.children - Child components.
 * @returns {JSX.Element} Provider element.
 */
export function AuditFilterProvider({ children }: { children: ReactNode }) {
    const [filters, setFilters] = useState<AuditFilters>(DEFAULT_AUDIT_FILTERS)
    const [showFilters, setShowFilters] = useState(false)

    /** Update a single filter field by key */
    const setFilter = useCallback((key: keyof AuditFilters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }))
    }, [])

    /** Reset all filters to default empty state */
    const clearFilters = useCallback(() => {
        setFilters(DEFAULT_AUDIT_FILTERS)
    }, [])

    /** Toggle the filter panel open/closed */
    const toggleFilters = useCallback(() => {
        setShowFilters(prev => !prev)
    }, [])

    /** Derived: true when any filter has a non-empty value */
    const hasActiveFilters = useMemo(
        () => Object.values(filters).some(v => v !== ''),
        [filters]
    )

    const value = useMemo<AuditFilterContextValue>(() => ({
        filters,
        setFilter,
        clearFilters,
        showFilters,
        toggleFilters,
        hasActiveFilters,
    }), [filters, setFilter, clearFilters, showFilters, toggleFilters, hasActiveFilters])

    return (
        <AuditFilterContext.Provider value={value}>
            {children}
        </AuditFilterContext.Provider>
    )
}

/**
 * @description Hook to consume the audit filter context.
 * Must be used within an AuditFilterProvider.
 *
 * @returns {AuditFilterContextValue} Filter state and handlers.
 * @throws {Error} If used outside of AuditFilterProvider.
 */
export function useAuditFilters(): AuditFilterContextValue {
    const ctx = useContext(AuditFilterContext)
    if (!ctx) {
        throw new Error('useAuditFilters must be used within an AuditFilterProvider')
    }
    return ctx
}
