/**
 * @fileoverview Admin search detail view component.
 * Displays sticky header with session ID, search queries, AI summaries, and file results.
 *
 * @module features/histories/components/AdminSearchDetailView
 */
import { useTranslation } from 'react-i18next'
import { Search, FileText, Clock, Sparkles, PanelLeft } from 'lucide-react'

import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { HighlightMatch } from '@/features/history/components/HighlightMatch'
import { useKnowledgeBase } from '@/features/knowledge-base/context/KnowledgeBaseContext'
import type { SearchSessionSummary, ExternalSearchHistory } from '../types/histories.types'

/**
 * Props for the AdminSearchDetailView component.
 */
interface AdminSearchDetailViewProps {
    /** The selected session summary. */
    session: SearchSessionSummary
    /** Detailed search records for the session. */
    details: ExternalSearchHistory[]
    /** Whether details are loading. */
    isLoadingDetails: boolean
    /** Current search query for text highlighting. */
    searchQuery: string
    /** Whether the sidebar is open. */
    isSidebarOpen: boolean
    /** Open the sidebar. */
    onOpenSidebar: () => void
}

/**
 * Admin search detail view showing session ID, search queries, AI summaries, and file results.
 * @param props - Component props.
 * @returns Rendered admin search detail view.
 */
export const AdminSearchDetailView = ({
    session,
    details,
    isLoadingDetails,
    searchQuery,
    isSidebarOpen,
    onOpenSidebar,
}: AdminSearchDetailViewProps) => {
    const { t } = useTranslation()
    const { config } = useKnowledgeBase()

    return (
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 pb-12 px-0">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-8 py-4 shadow-sm">
                <div className="mx-auto">
                    <div className="flex items-center gap-4 mb-2">
                        {!isSidebarOpen && (
                            <button
                                onClick={onOpenSidebar}
                                className="p-2 mr-2 rounded-lg text-slate-500 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                title={t('nav.expandMenu')}
                            >
                                <PanelLeft size={20} />
                            </button>
                        )}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-blue-500/25">
                            <Search size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                {t('histories.searchSession', 'Search Session')}
                            </h2>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                                <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    {new Date(session.created_at).toLocaleString()}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                                <span className="font-mono opacity-70">ID: {session.session_id}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mx-auto space-y-10 px-8 pt-8">
                {isLoadingDetails ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                        <p className="text-sm font-medium">{t('histories.loadingDetails', 'Restoring context...')}</p>
                    </div>
                ) : (
                    details.map((item, index) => (
                        <div key={item.id || index} className="group animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="space-y-6">
                                {/* Search Query */}
                                <div className="flex justify-end pl-12">
                                    <div className="relative max-w-[90%]">
                                        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-5 rounded-2xl rounded-tr-sm shadow-lg shadow-blue-500/20 text-white">
                                            <h3 className="text-lg font-medium italic">
                                                "<HighlightMatch text={item.search_input} query={searchQuery} />"
                                            </h3>
                                        </div>
                                    </div>
                                </div>

                                {/* Search Results */}
                                <div className="flex gap-5">
                                    <div className="flex-shrink-0">
                                        <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center ring-1 ring-inset ring-blue-500/20">
                                            <Search size={16} className="text-blue-500" />
                                        </div>
                                    </div>
                                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group/card">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />

                                        {item.ai_summary && (
                                            <div className="mb-6 pb-6 border-b border-dashed border-slate-200 dark:border-slate-800">
                                                <div className="flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-300">
                                                    <Sparkles size={14} />
                                                    <span className="text-xs font-bold uppercase tracking-wider">{t('histories.aiSummary', 'AI Summary')}</span>
                                                </div>
                                                <div className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                                    <MarkdownRenderer highlightText={searchQuery}>
                                                        {item.ai_summary}
                                                    </MarkdownRenderer>
                                                </div>
                                            </div>
                                        )}

                                        {item.file_results?.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                    <FileText size={14} />
                                                    <span className="text-xs font-bold uppercase tracking-wider">{t('histories.fileResults', 'Retrieved Files')}</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {item.file_results.map((file: any, idx: number) => {
                                                        const isObject = typeof file === 'object' && file !== null
                                                        const fileName = isObject ? file.document_name : file
                                                        const documentId = isObject ? file.document_id : null
                                                        const link = documentId && config?.kbBaseUrl
                                                            ? `${config.kbBaseUrl}/document/${documentId}?ext=pdf&prefix=document`
                                                            : null

                                                        return (
                                                            <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                                                <div className="mt-0.5 bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-sm">
                                                                    <FileText size={16} className="text-blue-500 dark:text-blue-400" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    {link ? (
                                                                        <a
                                                                            href={link}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate block hover:text-primary hover:underline"
                                                                            title={fileName}
                                                                        >
                                                                            <HighlightMatch text={fileName} query={searchQuery} />
                                                                        </a>
                                                                    ) : (
                                                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" title={fileName}>
                                                                            <HighlightMatch text={fileName || ''} query={searchQuery} />
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
