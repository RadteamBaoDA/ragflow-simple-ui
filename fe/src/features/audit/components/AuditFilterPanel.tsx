/**
 * @fileoverview Filter panel component for audit logs.
 * Reads filter state from AuditFilterContext — no prop-drilling needed.
 * @module features/audit/components/AuditFilterPanel
 */
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { DatePicker } from 'antd'
import dayjs from 'dayjs'
import { useAuditFilters } from '../contexts/AuditFilterContext'
import { getActionBadge, formatResourceType } from './AuditActionBadge'

// ============================================================================
// Props
// ============================================================================

interface AuditFilterPanelProps {
    /** Available action types for the dropdown */
    actionTypes: string[]
    /** Available resource types for the dropdown */
    resourceTypes: string[]
}

// ============================================================================
// Component
// ============================================================================

/**
 * @description Collapsible filter panel with action, resource type, and date range filters.
 * Consumes filter state directly from AuditFilterContext.
 *
 * @param props - Action and resource type options.
 * @returns Filter panel element, or null when hidden.
 */
export function AuditFilterPanel({ actionTypes, resourceTypes }: AuditFilterPanelProps) {
    const { t } = useTranslation()
    const { filters, setFilter, clearFilters, showFilters, hasActiveFilters } = useAuditFilters()

    // Don't render when panel is hidden
    if (!showFilters) return null

    return (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            {/* Header row with title and clear button */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('auditLog.filterBy')}
                </span>
                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                    >
                        <X className="w-3 h-3" />
                        {t('auditLog.clearFilters')}
                    </button>
                )}
            </div>

            {/* Filter controls grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Action Filter */}
                <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {t('auditLog.action')}
                    </label>
                    <select
                        value={filters.action}
                        onChange={(e) => setFilter('action', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                    >
                        <option value="">{t('auditLog.allActions')}</option>
                        {actionTypes.map(action => (
                            <option key={action} value={action}>
                                {getActionBadge(action, t).label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Resource Type Filter */}
                <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {t('auditLog.resourceType')}
                    </label>
                    <select
                        value={filters.resourceType}
                        onChange={(e) => setFilter('resourceType', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                    >
                        <option value="">{t('auditLog.allResourceTypes')}</option>
                        {resourceTypes.map(type => (
                            <option key={type} value={type}>
                                {formatResourceType(type, t)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Start Date */}
                <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {t('auditLog.startDate')}
                    </label>
                    <DatePicker
                        showTime
                        className="w-full"
                        value={filters.startDate ? dayjs(filters.startDate) : null}
                        onChange={(date) => setFilter('startDate', date?.toISOString() || '')}
                        placeholder={t('auditLog.startDate')}
                        disabledDate={(current) => filters.endDate ? current > dayjs(filters.endDate) : false}
                    />
                </div>

                {/* End Date */}
                <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {t('auditLog.endDate')}
                    </label>
                    <DatePicker
                        showTime
                        className="w-full"
                        value={filters.endDate ? dayjs(filters.endDate) : null}
                        onChange={(date) => setFilter('endDate', date?.toISOString() || '')}
                        placeholder={t('auditLog.endDate')}
                        disabledDate={(current) => filters.startDate ? current < dayjs(filters.startDate) : false}
                    />
                </div>
            </div>
        </div>
    )
}
