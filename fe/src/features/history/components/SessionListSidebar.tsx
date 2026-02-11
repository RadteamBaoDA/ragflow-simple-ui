/**
 * @fileoverview Collapsible sidebar with search, filter, and infinite-scroll session list.
 * @module features/history/components/SessionListSidebar
 */
import type { ReactNode, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Filter,
    Search,
    ChevronRight,
    PanelLeftClose,
    RefreshCw,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'
import { HighlightMatch } from './HighlightMatch'

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for how to display a session item in the list.
 */
export interface SessionItemConfig<T> {
    /** Extract the unique ID from a session item. */
    getId: (item: T) => string
    /** Extract the primary display text from a session item. */
    getText: (item: T) => string
    /** Extract the creation date string from a session item. */
    getDate: (item: T) => string
    /** Extract the optional source name from a session item. */
    getSourceName: (item: T) => string | undefined
    /** Extract the message/result count from a session item. */
    getCount: (item: T) => string | number
    /** Label for the count badge (e.g., "msgs", "results"). */
    countLabel: string
}

/**
 * Props for the SessionListSidebar component.
 */
interface SessionListSidebarProps<T> {
    /** Whether the sidebar is open. */
    isOpen: boolean
    /** Close the sidebar. */
    onClose: () => void
    /** Sidebar title. */
    title: string
    /** Icon for the title area. */
    icon: LucideIcon
    /** Gradient classes for the title icon background. */
    iconGradient: string
    /** Current search input value. */
    searchQuery: string
    /** Update search input. */
    onSearchChange: (value: string) => void
    /** Handle search form submission. */
    onSearch: (e: React.FormEvent) => void
    /** Executed search query (for highlighting). */
    executedSearchQuery: string
    /** Whether refresh is in progress. */
    isRefreshing: boolean
    /** Handle refresh action. */
    onRefresh: () => void
    /** Whether the filter is active. */
    isFiltered: boolean
    /** Open filter dialog. */
    onFilterClick: () => void
    /** Filter active accent color class. */
    filterActiveClass?: string
    /** Focus ring color class for search input. */
    searchFocusClass?: string
    /** Whether the list is loading. */
    isLoading: boolean
    /** Spinner color class. */
    spinnerColor?: string
    /** The data items to render. */
    items: T[]
    /** Config for rendering each session item. */
    itemConfig: SessionItemConfig<T>
    /** Currently selected item ID. */
    selectedId: string | null
    /** Handle item click. */
    onItemClick: (item: T) => void
    /** Color class for the selected item indicator. */
    selectedColor?: string
    /** Ref for infinite scroll sentinel. */
    loadMoreRef: RefObject<HTMLDivElement | null>
    /** Icon for the empty state. */
    emptyIcon?: ReactNode
}

// ============================================================================
// Component
// ============================================================================

/**
 * Collapsible sidebar panel with search, filter, and infinite-scroll session list.
 * @param props - Component props.
 * @returns Rendered sidebar.
 */
export function SessionListSidebar<T>({
    isOpen,
    onClose,
    title,
    icon: TitleIcon,
    iconGradient,
    searchQuery,
    onSearchChange,
    onSearch,
    executedSearchQuery,
    isRefreshing,
    onRefresh,
    isFiltered,
    onFilterClick,
    filterActiveClass = 'bg-primary/10 border-primary/20 text-primary',
    searchFocusClass = 'focus:ring-primary/20 group-focus-within:text-primary dark:group-focus-within:text-blue-400',
    isLoading,
    spinnerColor = 'border-primary/30 border-t-primary',
    items,
    itemConfig,
    selectedId,
    onItemClick,
    selectedColor = 'bg-primary',
    loadMoreRef,
    emptyIcon,
}: SessionListSidebarProps<T>) {
    const { t } = useTranslation()

    return (
        <div
            className={`border-r border-slate-200/60 dark:border-slate-800/60 flex flex-col bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-2xl z-20 transition-all duration-300 ease-in-out ${isOpen ? 'w-[360px] translate-x-0' : 'w-0 -translate-x-full opacity-0 overflow-hidden border-none'}`}
        >
            {/* Header */}
            <div className="p-5 space-y-4 border-b border-slate-100 dark:border-slate-800/50 relative group/sidebar-header">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-2 top-2 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all opacity-0 group-hover/sidebar-header:opacity-100 focus:opacity-100"
                    title={t('common.close')}
                >
                    <PanelLeftClose size={18} />
                </button>

                <div className="flex items-center gap-3 mt-4">
                    <div className={`w-10 h-10 rounded-xl ${iconGradient} flex items-center justify-center shadow-lg`}>
                        <TitleIcon size={20} className="text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
                </div>

                <form onSubmit={onSearch} className="flex gap-2">
                    <div className="relative flex-1 group">
                        <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300 transition-colors ${searchFocusClass}`} />
                        <input
                            type="text"
                            placeholder={t('userHistory.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-none ring-1 ring-slate-200 dark:ring-slate-800 rounded-xl focus:ring-2 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-medium ${searchFocusClass}`}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={onRefresh}
                        className={`p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                        title={t('common.refresh')}
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={onFilterClick}
                        className={`p-2.5 rounded-xl border transition-all duration-200 ${isFiltered
                            ? filterActiveClass
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <Filter size={18} />
                    </button>
                </form>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 bg-slate-50/30 dark:bg-black/20">
                {isLoading && items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                        <div className={`w-8 h-8 rounded-full border-2 ${spinnerColor} animate-spin`} />
                        <span className="text-sm font-medium animate-pulse">{t('userHistory.loading')}</span>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
                        {emptyIcon}
                        <span className="text-sm font-medium">{t('userHistory.noSessions')}</span>
                    </div>
                ) : (
                    <div className="p-3 space-y-2">
                        {items.map((item) => {
                            const id = itemConfig.getId(item)
                            const isSelected = selectedId === id
                            return (
                                <div
                                    key={id || Math.random().toString()}
                                    onClick={() => onItemClick(item)}
                                    className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-300 border ${isSelected
                                        ? `bg-white dark:bg-slate-800 shadow-lg shadow-${selectedColor}/5 border-${selectedColor}/20 dark:border-${selectedColor}/20 translate-x-1`
                                        : 'bg-white/50 dark:bg-slate-900/40 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700'
                                        }`}
                                >
                                    {isSelected && (
                                        <div className={`absolute left-0 top-3 bottom-3 w-1 ${selectedColor} rounded-r-full`} />
                                    )}

                                    <div className="pl-2 space-y-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <h3 className={`font-semibold text-sm leading-snug line-clamp-2 transition-colors ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                                <HighlightMatch text={itemConfig.getText(item)} query={executedSearchQuery} />
                                            </h3>
                                            <span className="text-[10px] font-mono whitespace-nowrap text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                {new Date(itemConfig.getDate(item)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-xs mt-2">
                                            <div className="flex items-center gap-2">
                                                {itemConfig.getSourceName(item) && (
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-50/50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/30">
                                                        <span className="truncate max-w-[100px] font-bold text-[10px] text-violet-600 dark:text-violet-400 uppercase tracking-wide">{itemConfig.getSourceName(item)}</span>
                                                    </div>
                                                )}
                                                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium text-[10px] text-slate-400 dark:text-slate-300">
                                                    {itemConfig.getCount(item)} {itemConfig.countLabel}
                                                </span>
                                            </div>
                                            <ChevronRight size={12} className={`transition-transform duration-300 ${isSelected ? `translate-x-1 text-${selectedColor}` : 'opacity-0 group-hover:opacity-100'}`} />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}

                        <div ref={loadMoreRef} className="h-4" />
                    </div>
                )}
            </div>
        </div>
    )
}
