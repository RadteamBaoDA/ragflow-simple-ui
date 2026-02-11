/**
 * @fileoverview Chat message detail view component.
 * Displays sticky header, user messages, AI responses, and citations.
 *
 * @module features/history/components/ChatMessageView
 */
import { useTranslation } from 'react-i18next'
import { MessageSquare, Clock, Sparkles, PanelLeft } from 'lucide-react'

import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { useKnowledgeBase } from '@/features/knowledge-base/context/KnowledgeBaseContext'
import type { ChatSessionSummary, ExternalChatHistory } from '../api/historyService'

/**
 * Props for the ChatMessageView component.
 */
interface ChatMessageViewProps {
    /** The selected session summary. */
    session: ChatSessionSummary
    /** Detailed message records for the session. */
    details: ExternalChatHistory[] | undefined
    /** Whether details are loading. */
    isLoadingDetails: boolean
    /** Current search query for text highlighting. */
    searchQuery: string
    /** Whether the sidebar is open (controls expand button visibility). */
    isSidebarOpen: boolean
    /** Open the sidebar. */
    onOpenSidebar: () => void
}

/**
 * Main content area displaying chat conversation messages.
 * @param props - Component props.
 * @returns Rendered chat message detail view.
 */
export const ChatMessageView = ({
    session,
    details,
    isLoadingDetails,
    searchQuery,
    isSidebarOpen,
    onOpenSidebar,
}: ChatMessageViewProps) => {
    const { t } = useTranslation()
    const { config } = useKnowledgeBase()

    return (
        <>
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 pb-12 px-0">
                {/* Sticky Header */}
                <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-8 py-4 shadow-sm">
                    <div className="mx-auto">
                        <div className="flex items-center gap-4 mb-2">
                            {!isSidebarOpen && (
                                <button
                                    onClick={onOpenSidebar}
                                    className="p-2 mr-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                    title={t('nav.expandMenu')}
                                >
                                    <PanelLeft size={20} />
                                </button>
                            )}
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-primary to-violet-600 text-white shadow-primary/25">
                                <MessageSquare size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                    {t('userHistory.conversationHistory')}
                                </h2>
                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                                    <span className="flex items-center gap-1">
                                        <Clock size={12} />
                                        {new Date(session.created_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mx-auto space-y-10 px-8 pt-8">
                    {isLoadingDetails ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                            <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                            <p className="text-sm font-medium">{t('userHistory.loadingDetails')}</p>
                        </div>
                    ) : (
                        (details || []).map((item, index) => (
                            <div key={item.id || index} className="group animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards" style={{ animationDelay: `${index * 100}ms` }}>
                                <div className="space-y-6">
                                    {/* User Message */}
                                    <div className="flex justify-end pl-12">
                                        <div className="relative max-w-[90%]">
                                            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl rounded-tr-sm shadow-sm border border-slate-100 dark:border-slate-800">
                                                <div className="text-slate-800 dark:text-slate-200 leading-relaxed">
                                                    <MarkdownRenderer highlightText={searchQuery}>
                                                        {item.user_prompt}
                                                    </MarkdownRenderer>
                                                </div>
                                            </div>
                                            <div className="absolute -right-2 top-0 w-2 h-2 bg-white dark:bg-slate-800 [clip-path:polygon(0_0,0%_100%,100%_0)]" />
                                            <div className="mt-2 flex justify-end gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('userHistory.you')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* AI Response */}
                                    <div className="flex gap-5 pr-12">
                                        <div className="flex-shrink-0">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/10 to-violet-500/10 dark:from-primary/20 dark:to-violet-500/20 flex items-center justify-center ring-1 ring-inset ring-primary/20">
                                                <Sparkles size={16} className="text-primary dark:text-blue-300" />
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div className="bg-transparent text-slate-700 dark:text-slate-300 leading-relaxed overflow-hidden">
                                                <MarkdownRenderer highlightText={searchQuery}>
                                                    {item.llm_response}
                                                </MarkdownRenderer>
                                            </div>

                                            {/* Citations */}
                                            {item.citations?.length > 0 && (
                                                <div className="pt-2">
                                                    <div className="inline-flex flex-wrap gap-2">
                                                        {item.citations.map((citation: any, idx: number) => {
                                                            const isObject = typeof citation === 'object' && citation !== null
                                                            const content = isObject ? citation.document_name : citation
                                                            const documentId = isObject ? citation.document_id : null
                                                            const link = documentId && config?.kbBaseUrl
                                                                ? `${config.kbBaseUrl}/document/${documentId}?ext=pdf&prefix=document`
                                                                : null

                                                            return (
                                                                <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/80 dark:bg-slate-800/80 text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 hover:border-primary/30 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-default select-none">
                                                                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-slate-300">{idx + 1}</span>
                                                                    {link ? (
                                                                        <a
                                                                            href={link}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="truncate max-w-[200px] hover:text-primary hover:underline"
                                                                            title={content}
                                                                        >
                                                                            {content}
                                                                        </a>
                                                                    ) : (
                                                                        <span className="truncate max-w-[200px]" title={content}>{content}</span>
                                                                    )}
                                                                </span>
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
        </>
    )
}
