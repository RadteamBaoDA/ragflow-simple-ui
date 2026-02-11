/**
 * @fileoverview Search History page component.
 * Displays user's personal search history with filtering and detail view.
 *
 * @module features/history/pages/SearchHistoryPage
 */
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SearchSessionSummary } from '../api/historyService'
import { useSearchHistory } from '../hooks/useSearchHistory'
import { useHistoryFilters } from '../hooks/useHistoryFilters'
import { SessionListSidebar, type SessionItemConfig } from '../components/SessionListSidebar'
import { SearchResultView } from '../components/SearchResultView'
import { FilterDialog } from '../components/FilterDialog'
import { EmptyState } from '../components/EmptyState'

/**
 * Session item config for search sessions.
 * @description Maps SearchSessionSummary fields to generic sidebar item display.
 */
const searchItemConfig: SessionItemConfig<SearchSessionSummary> = {
    getId: (item) => item.session_id,
    getText: (item) => item.search_input,
    getDate: (item) => item.created_at,
    getSourceName: (item) => item.source_name,
    getCount: (item) => item.message_count,
    countLabel: 'results',
}

/**
 * SearchHistoryPage Component.
 *
 * Displays the user's personal search history with:
 * - Infinite scrolling session list in sidebar
 * - Search and date filtering
 * - Detailed view with AI summary and file results
 */
function SearchHistoryPage() {
    const { t } = useTranslation()

    // Filter and search state
    const filterState = useHistoryFilters()

    // Data fetching and session management
    const searchState = useSearchHistory(filterState.executedSearchQuery, filterState.filters)

    return (
        <div className="flex h-full bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 backdrop-blur-sm">
            {/* Sidebar */}
            <SessionListSidebar<SearchSessionSummary>
                isOpen={searchState.isSidebarOpen}
                onClose={() => searchState.setIsSidebarOpen(false)}
                title={t('userHistory.searchHistory')}
                icon={Search}
                iconGradient="bg-gradient-to-br from-blue-500 to-cyan-500 shadow-blue-500/25"
                searchQuery={filterState.searchQuery}
                onSearchChange={filterState.setSearchQuery}
                onSearch={filterState.handleSearch}
                executedSearchQuery={filterState.executedSearchQuery}
                isRefreshing={searchState.isRefreshing}
                onRefresh={searchState.handleRefresh}
                isFiltered={filterState.isFiltered}
                onFilterClick={filterState.openFilterDialog}
                isLoading={searchState.isLoading}
                spinnerColor="border-blue-500/30 border-t-blue-500"
                items={searchState.flattenedData}
                itemConfig={searchItemConfig}
                selectedId={searchState.selectedSession?.session_id ?? null}
                onItemClick={(item) => searchState.setSelectedSession(item)}
                selectedColor="bg-blue-500"
                loadMoreRef={searchState.loadMoreRef}
                emptyIcon={<Search size={48} className="opacity-30" />}
                filterActiveClass="bg-blue-500/10 border-blue-500/20 text-blue-500"
                searchFocusClass="focus:ring-blue-500/20 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400"
            />

            {/* Main Content */}
            <div className="flex-1 relative overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
                {searchState.selectedSession ? (
                    <SearchResultView
                        session={searchState.selectedSession}
                        details={searchState.sessionDetails}
                        isLoadingDetails={searchState.isLoadingDetails}
                        searchQuery={filterState.executedSearchQuery}
                        isSidebarOpen={searchState.isSidebarOpen}
                        onOpenSidebar={() => searchState.setIsSidebarOpen(true)}
                    />
                ) : (
                    <EmptyState
                        icon={Search}
                        title={t('userHistory.noSessionSelected')}
                        subtitle={t('userHistory.selectSearchHint')}
                        glowColor="rgba(59,130,246,0.3)"
                    />
                )}
            </div>

            {/* Filter Dialog */}
            <FilterDialog
                open={filterState.isFilterDialogOpen}
                onClose={() => filterState.setIsFilterDialogOpen(false)}
                tempFilters={filterState.tempFilters}
                setTempFilters={filterState.setTempFilters}
                onApply={filterState.handleApplyFilters}
                onReset={filterState.handleResetFilters}
                accentClass="bg-blue-500 shadow-blue-500/25 hover:shadow-blue-500/40"
            />
        </div>
    )
}

export default SearchHistoryPage
