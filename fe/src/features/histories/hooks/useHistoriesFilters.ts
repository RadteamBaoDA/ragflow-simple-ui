/**
 * @fileoverview Filter and search state management hook for admin histories.
 * Includes email and sourceName fields not present in user-level history.
 *
 * @module features/histories/hooks/useHistoriesFilters
 */
import { useState, useCallback } from 'react'
import type { FilterState } from '../types/histories.types'

/** Default empty filter state. */
const EMPTY_FILTERS: FilterState = { email: '', startDate: '', endDate: '', sourceName: '' }

/**
 * Return type for useHistoriesFilters hook.
 */
export interface UseHistoriesFiltersReturn {
    searchQuery: string
    setSearchQuery: (value: string) => void
    executedSearchQuery: string
    filters: FilterState
    tempFilters: FilterState
    setTempFilters: (filters: FilterState) => void
    isFilterDialogOpen: boolean
    setIsFilterDialogOpen: (open: boolean) => void
    isFiltered: boolean
    handleSearch: (e: React.FormEvent) => void
    openFilterDialog: () => void
    handleApplyFilters: () => void
    handleResetFilters: () => void
}

/**
 * Manages search query, filter dialog, and filter state for admin histories.
 * @returns Filter state and handlers.
 */
export const useHistoriesFilters = (): UseHistoriesFiltersReturn => {
    // Search state
    const [searchQuery, setSearchQuery] = useState('')
    const [executedSearchQuery, setExecutedSearchQuery] = useState('')

    // Filter state
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
    const [tempFilters, setTempFilters] = useState<FilterState>(EMPTY_FILTERS)
    const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)

    // Derived: any filter active
    const isFiltered = !!(filters.email || filters.startDate || filters.endDate || filters.sourceName)

    /** Submit search — copy searchQuery to executedSearchQuery. */
    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault()
        setExecutedSearchQuery(searchQuery)
    }, [searchQuery])

    /** Open filter dialog, sync temp filters from current filters. */
    const openFilterDialog = useCallback(() => {
        setTempFilters(filters)
        setIsFilterDialogOpen(true)
    }, [filters])

    /** Apply temp filters to actual filters and close dialog. */
    const handleApplyFilters = useCallback(() => {
        setFilters(tempFilters)
        setIsFilterDialogOpen(false)
    }, [tempFilters])

    /** Reset all filters and close dialog. */
    const handleResetFilters = useCallback(() => {
        setTempFilters(EMPTY_FILTERS)
        setFilters(EMPTY_FILTERS)
    }, [])

    return {
        searchQuery,
        setSearchQuery,
        executedSearchQuery,
        filters,
        tempFilters,
        setTempFilters,
        isFilterDialogOpen,
        setIsFilterDialogOpen,
        isFiltered,
        handleSearch,
        openFilterDialog,
        handleApplyFilters,
        handleResetFilters,
    }
}
