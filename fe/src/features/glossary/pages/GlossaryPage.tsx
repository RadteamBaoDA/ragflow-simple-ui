/**
 * @fileoverview Glossary Management Page — thin orchestrator with 2-tab layout.
 *
 * Tab 1: Task Management (via TaskManagementTab component)
 * Tab 2: Keyword Management (via KeywordManagementTab component)
 *
 * All state and business logic is delegated to custom hooks.
 * @module features/glossary/pages/GlossaryPage
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Tag } from 'lucide-react'
import { Tabs } from 'antd'
import { useAuth } from '@/features/auth'
import { useGlossaryTasks } from '../hooks/useGlossaryTasks'
import { useGlossaryKeywords } from '../hooks/useGlossaryKeywords'
import { TaskManagementTab } from '../components/TaskManagementTab'
import { KeywordManagementTab } from '../components/KeywordManagementTab'
import { GlossaryBulkImportModal } from '../components/GlossaryBulkImportModal'

// ============================================================================
// Component
// ============================================================================

/**
 * Glossary Management Page — orchestrates two tabs for task and keyword management.
 * @description Delegates all state to useGlossaryTasks and useGlossaryKeywords hooks.
 * @returns React element.
 */
export const GlossaryPage = () => {
    const { t } = useTranslation()
    const { user } = useAuth()

    // Determine admin/leader privileges
    const isAdmin = user?.role === 'admin' || user?.role === 'leader'

    // Active tab and bulk import modal state
    const [activeTab, setActiveTab] = useState('tasks')
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)

    // Initialize hooks — keyword hook defers fetching until its tab is active
    const taskHook = useGlossaryTasks()
    const keywordHook = useGlossaryKeywords(activeTab === 'keywords')

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div className="h-full flex flex-col">
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                className="h-full glossary-tabs"
                items={[
                    {
                        key: 'tasks',
                        label: (
                            <span className="flex items-center gap-2">
                                <BookOpen size={16} />
                                {t('glossary.tabs.tasks')}
                            </span>
                        ),
                        children: (
                            <TaskManagementTab
                                taskHook={taskHook}
                                isAdmin={isAdmin}
                                onOpenBulkImport={() => setIsBulkImportOpen(true)}
                            />
                        ),
                    },
                    {
                        key: 'keywords',
                        label: (
                            <span className="flex items-center gap-2">
                                <Tag size={16} />
                                {t('glossary.tabs.keywords')}
                            </span>
                        ),
                        children: (
                            <KeywordManagementTab
                                keywordHook={keywordHook}
                                isAdmin={isAdmin}
                            />
                        ),
                    },
                ]}
            />

            {/* Bulk Import Modal — shared across tabs */}
            <GlossaryBulkImportModal
                open={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                onSuccess={() => {
                    taskHook.refresh()
                    if (activeTab === 'keywords') keywordHook.refresh()
                }}
            />
        </div>
    )
}

export default GlossaryPage
