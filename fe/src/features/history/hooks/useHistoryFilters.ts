/**
 * @fileoverview Shared hook for history filter and search state management.
 * Used by both ChatHistoryPage and SearchHistoryPage.
 *
 * @module features/history/hooks/useHistoryFilters
 */
import { useState, useCallback } from 'react'

import type { FilterState } from '../api/historyService'

/**
 * Return type for the useHistoryFilters hook.
 * @description Exposes filter/search state and handlers.
 */
export interface UseHistoryFiltersReturn {
    /** Current search input value. */
    searchQuery: string
    /** Set the search input value. */
    setSearchQuery: (value: string) => void
    /** The search query that was actually executed (on form submit). */
    executedSearchQuery: string
    /** Active filters applied to the query. */
    filters: FilterState
    /** Temporary filters in the dialog before applying. */
    tempFilters: FilterState
    /** Set temporary filters. */
    setTempFilters: (filters: FilterState) => void
    /** Whether the filter dialog is open. */
    isFilterDialogOpen: boolean
    /** Set filter dialog open state. */
    setIsFilterDialogOpen: (open: boolean) => void
    /** Whether any filter is active. */
    isFiltered: boolean
    /** Handle search form submission. */
    handleSearch: (e: React.FormEvent) => void
    /** Apply filters from dialog. */
    handleApplyFilters: () => void
    /** Reset filters to default. */
    handleResetFilters: () => void
    /** Open filter dialog with current filters. */
    openFilterDialog: () => void
}

/**
 * Shared hook for managing search query and date range filters.
 * @description Handles search input, filter dialog state, applying/resetting filters.
 * @returns Filter state and handler functions.
 */
export const useHistoryFilters = (): UseHistoryFiltersReturn => {
    // Search state
    const [searchQuery, setSearchQuery] = useState('')
    const [executedSearchQuery, setExecutedSearchQuery] = useState('')

    // Filter state
    const [filters, setFilters] = useState<FilterState>({ startDate: '', endDate: '' })
    const [tempFilters, setTempFilters] = useState<FilterState>({ startDate: '', endDate: '' })
    const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)

    /** Whether any filter is currently active. */
    const isFiltered = !!(filters.startDate || filters.endDate)

    /**
     * Handle search form submission.
     * @param e - Form submission event.
     */
    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault()
        setExecutedSearchQuery(searchQuery)
    }, [searchQuery])

    /**
     * Apply filters from dialog.
     */
    const handleApplyFilters = useCallback(() => {
        setFilters(tempFilters)
        setIsFilterDialogOpen(false)
    }, [tempFilters])

    /**
     * Reset filters to default.
     */
    const handleResetFilters = useCallback(() => {
        const reset = { startDate: '', endDate: '' }
        setTempFilters(reset)
        setFilters(reset)
    }, [])

    /**
     * Open filter dialog with current filters pre-filled.
     */
    const openFilterDialog = useCallback(() => {
        setTempFilters(filters)
        setIsFilterDialogOpen(true)
    }, [filters])

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
        handleApplyFilters,
        handleResetFilters,
        openFilterDialog,
    }
}
