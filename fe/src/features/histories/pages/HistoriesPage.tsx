/**
 * @fileoverview Admin Histories page component.
 * Displays system-wide chat and search history with filtering and detail views.
 *
 * @module features/histories/pages/HistoriesPage
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, PanelLeft } from 'lucide-react'

import { useFirstVisit, GuidelineDialog } from '@/features/guideline'
import { EmptyState } from '@/features/history/components/EmptyState'
import type { ChatSessionSummary, ExternalChatHistory, ExternalSearchHistory } from '../types/histories.types'
import { useHistoriesFilters } from '../hooks/useHistoriesFilters'
import { useHistoriesData } from '../hooks/useHistoriesData'
import { AdminSessionListSidebar } from '../components/AdminSessionListSidebar'
import { AdminFilterDialog } from '../components/AdminFilterDialog'
import { AdminChatDetailView } from '../components/AdminChatDetailView'
import { AdminSearchDetailView } from '../components/AdminSearchDetailView'

/**
 * HistoriesPage Component.
 *
 * Admin page to view system-wide chat and search history with:
 * - Chat / Search tab switcher
 * - Infinite scrolling sessions with user email badges
 * - Email, sourceName, and date range filters
 * - Detailed session view
 * - First-visit guideline dialog
 */
function HistoriesPage() {
    const { t } = useTranslation()

    // Guideline dialog for first-time visitors
    const { isFirstVisit } = useFirstVisit('global-histories')
    const [showGuide, setShowGuide] = useState(false)
    useEffect(() => {
        if (isFirstVisit) setShowGuide(true)
    }, [isFirstVisit])

    // Filter and search state
    const filterState = useHistoriesFilters()

    // Data fetching, tab management, and session state
    const dataState = useHistoriesData(filterState.executedSearchQuery, filterState.filters)

    /**
     * Handle tab switch — also resets search/filters.
     * @param tab - Target tab ('chat' | 'search').
     */
    const handleTabSwitch = (tab: 'chat' | 'search') => {
        dataState.switchTab(tab)
        filterState.setSearchQuery('')
        filterState.handleResetFilters()
    }

    return (
        <div className="flex h-full bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 backdrop-blur-sm">
            {/* Sidebar */}
            <AdminSessionListSidebar
                isOpen={dataState.isSidebarOpen}
                onClose={() => dataState.setIsSidebarOpen(false)}
                activeTab={dataState.activeTab}
                onSwitchTab={handleTabSwitch}
                searchQuery={filterState.searchQuery}
                onSearchChange={filterState.setSearchQuery}
                onSearch={(e) => { filterState.handleSearch(e); dataState.setSelectedSession(null) }}
                executedSearchQuery={filterState.executedSearchQuery}
                isRefreshing={dataState.isRefreshing}
                onRefresh={dataState.handleRefresh}
                isFiltered={filterState.isFiltered}
                onFilterClick={filterState.openFilterDialog}
                isLoading={dataState.isLoading}
                items={dataState.flattenedData}
                selectedSession={dataState.selectedSession}
                onItemClick={(item) => dataState.setSelectedSession(item)}
                loadMoreRef={dataState.loadMoreRef}
                onResetSearch={() => { filterState.setSearchQuery(''); filterState.handleResetFilters() }}
            />

            {/* Main Content */}
            <div className="flex-1 relative overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
                {dataState.selectedSession ? (
                    dataState.activeTab === 'chat' ? (
                        <AdminChatDetailView
                            session={dataState.selectedSession as ChatSessionSummary}
                            details={(dataState.sessionDetails || []) as ExternalChatHistory[]}
                            isLoadingDetails={dataState.isLoadingDetails}
                            searchQuery={filterState.executedSearchQuery}
                            isSidebarOpen={dataState.isSidebarOpen}
                            onOpenSidebar={() => dataState.setIsSidebarOpen(true)}
                        />
                    ) : (
                        <AdminSearchDetailView
                            session={dataState.selectedSession as any}
                            details={(dataState.sessionDetails || []) as ExternalSearchHistory[]}
                            isLoadingDetails={dataState.isLoadingDetails}
                            searchQuery={filterState.executedSearchQuery}
                            isSidebarOpen={dataState.isSidebarOpen}
                            onOpenSidebar={() => dataState.setIsSidebarOpen(true)}
                        />
                    )
                ) : (
                    <div className="flex-1 flex flex-col">
                        {!dataState.isSidebarOpen && (
                            <button
                                onClick={() => dataState.setIsSidebarOpen(true)}
                                className="absolute top-4 left-4 p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-all z-10"
                                title={t('nav.expandMenu')}
                            >
                                <PanelLeft size={24} />
                            </button>
                        )}
                        <EmptyState
                            icon={MessageSquare}
                            title={t('histories.noSessionSelected', 'No Session Selected')}
                            subtitle={t('histories.selectSessionHint', 'Select a conversation or search session from the sidebar to view details.')}
                            glowColor="rgba(120,119,198,0.3)"
                        />
                    </div>
                )}
            </div>

            {/* Filter Dialog */}
            <AdminFilterDialog
                open={filterState.isFilterDialogOpen}
                onClose={() => filterState.setIsFilterDialogOpen(false)}
                tempFilters={filterState.tempFilters}
                setTempFilters={filterState.setTempFilters}
                onApply={filterState.handleApplyFilters}
                onReset={filterState.handleResetFilters}
            />

            {/* First Visit Guideline */}
            <GuidelineDialog
                open={showGuide}
                onClose={() => setShowGuide(false)}
                featureId="global-histories"
            />
        </div>
    )
}

export default HistoriesPage