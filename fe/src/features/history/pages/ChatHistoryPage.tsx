/**
 * @fileoverview Chat History page component.
 * Displays user's personal chat history with filtering and detail view.
 *
 * @module features/history/pages/ChatHistoryPage
 */
import { MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ChatSessionSummary } from '../api/historyService'
import { useChatHistory } from '../hooks/useChatHistory'
import { useHistoryFilters } from '../hooks/useHistoryFilters'
import { SessionListSidebar, type SessionItemConfig } from '../components/SessionListSidebar'
import { ChatMessageView } from '../components/ChatMessageView'
import { FilterDialog } from '../components/FilterDialog'
import { EmptyState } from '../components/EmptyState'

/**
 * Session item config for chat sessions.
 * @description Maps ChatSessionSummary fields to generic sidebar item display.
 */
const chatItemConfig: SessionItemConfig<ChatSessionSummary> = {
    getId: (item) => item.session_id,
    getText: (item) => item.user_prompt,
    getDate: (item) => item.created_at,
    getSourceName: (item) => item.source_name,
    getCount: (item) => item.message_count,
    countLabel: 'msgs',
}

/**
 * ChatHistoryPage Component.
 *
 * Displays the user's personal chat history with:
 * - Infinite scrolling session list in sidebar
 * - Search and date filtering
 * - Detailed message view for selected session
 */
function ChatHistoryPage() {
    const { t } = useTranslation()

    // Filter and search state
    const filterState = useHistoryFilters()

    // Data fetching and session management
    const chatState = useChatHistory(filterState.executedSearchQuery, filterState.filters)

    return (
        <div className="flex h-full bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 backdrop-blur-sm">
            {/* Sidebar */}
            <SessionListSidebar<ChatSessionSummary>
                isOpen={chatState.isSidebarOpen}
                onClose={() => chatState.setIsSidebarOpen(false)}
                title={t('userHistory.chatHistory')}
                icon={MessageSquare}
                iconGradient="bg-gradient-to-br from-primary to-violet-600 shadow-primary/25"
                searchQuery={filterState.searchQuery}
                onSearchChange={filterState.setSearchQuery}
                onSearch={filterState.handleSearch}
                executedSearchQuery={filterState.executedSearchQuery}
                isRefreshing={chatState.isRefreshing}
                onRefresh={chatState.handleRefresh}
                isFiltered={filterState.isFiltered}
                onFilterClick={filterState.openFilterDialog}
                isLoading={chatState.isLoading}
                spinnerColor="border-primary/30 border-t-primary"
                items={chatState.flattenedData}
                itemConfig={chatItemConfig}
                selectedId={chatState.selectedSession?.session_id ?? null}
                onItemClick={(item) => chatState.setSelectedSession(item)}
                selectedColor="bg-primary"
                loadMoreRef={chatState.loadMoreRef}
                emptyIcon={<MessageSquare size={48} className="opacity-30" />}
            />

            {/* Main Content */}
            <div className="flex-1 relative overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
                {chatState.selectedSession ? (
                    <ChatMessageView
                        session={chatState.selectedSession}
                        details={chatState.sessionDetails}
                        isLoadingDetails={chatState.isLoadingDetails}
                        searchQuery={filterState.executedSearchQuery}
                        isSidebarOpen={chatState.isSidebarOpen}
                        onOpenSidebar={() => chatState.setIsSidebarOpen(true)}
                    />
                ) : (
                    <EmptyState
                        icon={MessageSquare}
                        title={t('userHistory.noSessionSelected')}
                        subtitle={t('userHistory.selectSessionHint')}
                        glowColor="rgba(120,119,198,0.3)"
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
            />
        </div>
    )
}

export default ChatHistoryPage
