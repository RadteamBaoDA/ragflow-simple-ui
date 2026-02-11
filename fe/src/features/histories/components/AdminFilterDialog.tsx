/**
 * @fileoverview Admin filter dialog with email, source name, and date range filters.
 * @module features/histories/components/AdminFilterDialog
 */
import { useTranslation } from 'react-i18next'
import { DatePicker } from 'antd'
import dayjs from 'dayjs'

import { Dialog } from '@/components/Dialog'
import type { FilterState } from '../types/histories.types'

/**
 * Props for the AdminFilterDialog component.
 */
interface AdminFilterDialogProps {
    /** Whether the dialog is open. */
    open: boolean
    /** Callback to close the dialog. */
    onClose: () => void
    /** Temporary filter values being edited. */
    tempFilters: FilterState
    /** Update temporary filter values. */
    setTempFilters: (filters: FilterState) => void
    /** Apply the current temporary filters. */
    onApply: () => void
    /** Reset all filters and close. */
    onReset: () => void
}

/**
 * Admin-specific filter dialog with email, source name, and date range fields.
 * @param props - Component props.
 * @returns Rendered filter dialog.
 */
export const AdminFilterDialog = ({
    open,
    onClose,
    tempFilters,
    setTempFilters,
    onApply,
    onReset,
}: AdminFilterDialogProps) => {
    const { t } = useTranslation()

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={t('histories.filterTitle', 'Filter History')}
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <button
                        onClick={() => { onClose(); onReset() }}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                    >
                        {t('common.reset')}
                    </button>
                    <button
                        onClick={onApply}
                        className="px-6 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
                    >
                        {t('histories.applyFilter', 'Apply Filters')}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                {/* Email Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        {t('histories.userEmail', 'User Email')}
                    </label>
                    <input
                        type="text"
                        value={tempFilters.email}
                        onChange={(e) => setTempFilters({ ...tempFilters, email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        placeholder="e.g. user@example.com"
                    />
                </div>

                {/* Source Name Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        {t('histories.sourceName', 'Source Name')}
                    </label>
                    <input
                        type="text"
                        value={tempFilters.sourceName || ''}
                        onChange={(e) => setTempFilters({ ...tempFilters, sourceName: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        placeholder="e.g. My Knowledge Base"
                    />
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            {t('common.startDate')}
                        </label>
                        <DatePicker
                            className="w-full"
                            value={tempFilters.startDate ? dayjs(tempFilters.startDate) : null}
                            onChange={(_, dateString) => setTempFilters({ ...tempFilters, startDate: dateString as string })}
                            placeholder={t('common.startDate')}
                            disabledDate={(current) => tempFilters.endDate ? current > dayjs(tempFilters.endDate) : false}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            {t('common.endDate')}
                        </label>
                        <DatePicker
                            className="w-full"
                            value={tempFilters.endDate ? dayjs(tempFilters.endDate) : null}
                            onChange={(_, dateString) => setTempFilters({ ...tempFilters, endDate: dateString as string })}
                            placeholder={t('common.endDate')}
                            disabledDate={(current) => tempFilters.startDate ? current < dayjs(tempFilters.startDate) : false}
                        />
                    </div>
                </div>
            </div>
        </Dialog>
    )
}
