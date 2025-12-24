/**
 * @fileoverview Audit log page for administrators.
 * 
 * Admin-only page for viewing all system audit logs:
 * - Paginated datatable with all audit entries
 * - Filtering by action type, resource type, date range
 * - Search across user email and details
 * - Full i18n support for all text
 * 
 * @module pages/AuditLogPage
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth';
import { useTranslation } from 'react-i18next';
import {
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    User,
    Clock,
    Globe,
    FileText,
    X,
    Calendar
} from 'lucide-react';

/** API base URL from environment */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// Type Definitions
// ============================================================================

/** Audit log entry from API */
interface AuditLogEntry {
    id: number;
    user_id: string | null;
    user_email: string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    details: Record<string, any>;
    ip_address: string | null;
    created_at: string;
}

/** Pagination metadata */
interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

/** API response shape */
interface AuditLogResponse {
    data: AuditLogEntry[];
    pagination: Pagination;
}

/** Filter state */
interface Filters {
    search: string;
    action: string;
    resourceType: string;
    startDate: string;
    endDate: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format action type for display with color coding.
 */
function getActionBadge(action: string, t: any): { label: string; className: string } {
    const actionMap: Record<string, { label: string; className: string }> = {
        login: { label: t('auditLog.actions.login'), className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
        logout: { label: t('auditLog.actions.logout'), className: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300' },
        login_failed: { label: t('auditLog.actions.login_failed'), className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
        create_user: { label: t('auditLog.actions.create_user'), className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
        update_user: { label: t('auditLog.actions.update_user'), className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
        delete_user: { label: t('auditLog.actions.delete_user'), className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
        update_role: { label: t('auditLog.actions.update_role'), className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
        create_bucket: { label: t('auditLog.actions.create_bucket'), className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
        delete_bucket: { label: t('auditLog.actions.delete_bucket'), className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
        upload_file: { label: t('auditLog.actions.upload_file'), className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
        delete_file: { label: t('auditLog.actions.delete_file'), className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
        download_file: { label: t('auditLog.actions.download_file'), className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
        create_folder: { label: t('auditLog.actions.create_folder'), className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
        delete_folder: { label: t('auditLog.actions.delete_folder'), className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
        update_config: { label: t('auditLog.actions.update_config'), className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
        reload_config: { label: t('auditLog.actions.reload_config'), className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
        run_migration: { label: t('auditLog.actions.run_migration'), className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
        system_start: { label: t('auditLog.actions.system_start'), className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
        system_stop: { label: t('auditLog.actions.system_stop'), className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },

        // Broadcast
        create_broadcast: { label: t('auditLog.actions.create_broadcast'), className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
        update_broadcast: { label: t('auditLog.actions.update_broadcast'), className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
        delete_broadcast: { label: t('auditLog.actions.delete_broadcast'), className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
        dismiss_broadcast: { label: t('auditLog.actions.dismiss_broadcast'), className: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300' },

        // Permission
        set_permission: { label: t('auditLog.actions.set_permission'), className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },

        // Knowledge Base
        create_source: { label: t('auditLog.actions.create_source'), className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
        update_source: { label: t('auditLog.actions.update_source'), className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
        delete_source: { label: t('auditLog.actions.delete_source'), className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },

        // Storage Batch
        batch_delete: { label: t('auditLog.actions.batch_delete'), className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
    };

    return actionMap[action] || {
        label: t(`auditLog.actions.${action}`, { defaultValue: action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }),
        className: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
    };
}

/**
 * Format resource type for display.
 */
function formatResourceType(type: string, t: any): string {
    const typeMap: Record<string, string> = {
        user: t('auditLog.resourceTypes.user'),
        session: t('auditLog.resourceTypes.session'),
        bucket: t('auditLog.resourceTypes.bucket'),
        file: t('auditLog.resourceTypes.file'),
        folder: t('auditLog.resourceTypes.folder'),
        config: t('auditLog.resourceTypes.config'),
        system: t('auditLog.resourceTypes.system'),
        role: t('auditLog.resourceTypes.role'),
        broadcast_message: t('auditLog.resourceTypes.broadcast_message'),
        permission: t('auditLog.resourceTypes.permission'),
        knowledge_base_source: t('auditLog.resourceTypes.knowledge_base_source'),
    };
    return typeMap[type] || t(`auditLog.resourceTypes.${type}`, { defaultValue: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) });
}

/**
 * Format date for display.
 */
function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString();
}

/**
 * Format details object for display.
 */
function formatDetails(details: Record<string, any>): string {
    if (!details || Object.keys(details).length === 0) return '-';

    const entries = Object.entries(details)
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([key, value]) => {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const formattedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            return `${formattedKey}: ${formattedValue}`;
        });

    return entries.join(', ');
}

// ============================================================================
// Component
// ============================================================================

/**
 * Audit log page for administrators.
 * 
 * Features:
 * - Paginated list of all audit logs
 * - Filter by action, resource type, date range
 * - Search in user email and details
 * - Admin-only access (verified client-side)
 */
export default function AuditLogPage() {
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();

    // Data state
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter state
    const [filters, setFilters] = useState<Filters>({
        search: '',
        action: '',
        resourceType: '',
        startDate: '',
        endDate: '',
    });
    const [showFilters, setShowFilters] = useState(false);

    // Available filter options
    const [actionTypes, setActionTypes] = useState<string[]>([]);
    const [resourceTypes, setResourceTypes] = useState<string[]>([]);

    // ============================================================================
    // Data Fetching
    // ============================================================================

    /**
     * Fetch audit logs with current filters and pagination.
     */
    const fetchLogs = useCallback(async (page: number = 1) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pagination.limit),
            });

            if (filters.search) params.append('search', filters.search);
            if (filters.action) params.append('action', filters.action);
            if (filters.resourceType) params.append('resourceType', filters.resourceType);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const response = await fetch(`${API_BASE_URL}/api/audit?${params}`, {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(t('auditLog.fetchError'));
            }

            const data: AuditLogResponse = await response.json();
            setLogs(data.data);
            setPagination(data.pagination);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('auditLog.fetchError'));
        } finally {
            setIsLoading(false);
        }
    }, [filters, pagination.limit, t]);

    /**
     * Fetch available filter options.
     */
    const fetchFilterOptions = useCallback(async () => {
        try {
            const [actionsRes, resourceTypesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/audit/actions`, { credentials: 'include' }),
                fetch(`${API_BASE_URL}/api/audit/resource-types`, { credentials: 'include' }),
            ]);

            if (actionsRes.ok) {
                const actions = await actionsRes.json();
                setActionTypes(actions);
            }
            if (resourceTypesRes.ok) {
                const types = await resourceTypesRes.json();
                setResourceTypes(types);
            }
        } catch (err) {
            console.error('Failed to fetch filter options:', err);
        }
    }, []);

    // ============================================================================
    // Effects
    // ============================================================================

    useEffect(() => {
        fetchLogs(1);
        fetchFilterOptions();
    }, []);

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            fetchLogs(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [filters]);

    // ============================================================================
    // Handlers
    // ============================================================================

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchLogs(newPage);
        }
    };

    const handleFilterChange = (key: keyof Filters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            action: '',
            resourceType: '',
            startDate: '',
            endDate: '',
        });
    };

    const hasActiveFilters = Object.values(filters).some(v => v !== '');

    // ============================================================================
    // Render
    // ============================================================================

    // Only allow admins
    if (currentUser?.role !== 'admin') {
        return (
            <div className="text-center text-slate-600 dark:text-slate-400 p-8">
                {t('auditLog.noPermission')}
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col p-6">
            {/* Header with Search and Filters */}
            <div className="mb-4 space-y-4">
                {/* Search and Filter Toggle Row */}
                <div className="flex items-center gap-4">
                    {/* Search Input */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('auditLog.searchPlaceholder')}
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>

                    {/* Filter Toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${showFilters || hasActiveFilters
                                ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-700 dark:text-primary-300'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <Filter className="w-4 h-4" />
                        {t('auditLog.filters')}
                        {hasActiveFilters && (
                            <span className="ml-1 w-2 h-2 rounded-full bg-primary-500" />
                        )}
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={() => fetchLogs(pagination.page)}
                        disabled={isLoading}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                        title={t('auditLog.refresh')}
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
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
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Action Filter */}
                            <div>
                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    {t('auditLog.action')}
                                </label>
                                <select
                                    value={filters.action}
                                    onChange={(e) => handleFilterChange('action', e.target.value)}
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
                                    onChange={(e) => handleFilterChange('resourceType', e.target.value)}
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
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-600 dark:text-primary-400 pointer-events-none z-10" />
                                    <input
                                        type="datetime-local"
                                        value={filters.startDate}
                                        onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* End Date */}
                            <div>
                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    {t('auditLog.endDate')}
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-600 dark:text-primary-400 pointer-events-none z-10" />
                                    <input
                                        type="datetime-local"
                                        value={filters.endDate}
                                        onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Results Summary */}
            <div className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                {t('auditLog.showing', {
                    from: Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total),
                    to: Math.min(pagination.page * pagination.limit, pagination.total),
                    total: pagination.total
                })}
            </div>

            {/* Data Table */}
            <div className="bg-white dark:bg-slate-800 flex-1 overflow-hidden flex flex-col rounded-lg border border-slate-200 dark:border-slate-700">
                {error ? (
                    <div className="flex-1 flex items-center justify-center text-red-500">
                        {error}
                    </div>
                ) : isLoading && logs.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        {t('auditLog.noLogs')}
                    </div>
                ) : (
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                    <th className="p-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {t('auditLog.timestamp')}
                                        </div>
                                    </th>
                                    <th className="p-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {t('auditLog.user')}
                                        </div>
                                    </th>
                                    <th className="p-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        {t('auditLog.action')}
                                    </th>
                                    <th className="p-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        {t('auditLog.resourceType')}
                                    </th>
                                    <th className="p-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <FileText className="w-3 h-3" />
                                            {t('auditLog.details')}
                                        </div>
                                    </th>
                                    <th className="p-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <Globe className="w-3 h-3" />
                                            {t('auditLog.ipAddress')}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {logs.map((log) => {
                                    const actionBadge = getActionBadge(log.action, t);
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="p-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                {formatDateTime(log.created_at)}
                                            </td>
                                            <td className="p-3 text-sm text-slate-900 dark:text-white">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium text-xs">
                                                        {log.user_email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="truncate max-w-[200px]" title={log.user_email}>
                                                        {log.user_email}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionBadge.className}`}>
                                                    {actionBadge.label}
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm text-slate-600 dark:text-slate-300">
                                                {formatResourceType(log.resource_type, t)}
                                            </td>
                                            <td className="p-3 text-sm text-slate-500 dark:text-slate-400 max-w-[300px]">
                                                <span className="truncate block" title={formatDetails(log.details)}>
                                                    {formatDetails(log.details)}
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm font-mono text-slate-500 dark:text-slate-400">
                                                {log.ip_address || '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t('auditLog.page', { page: pagination.page, totalPages: pagination.totalPages })}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page <= 1 || isLoading}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        {/* Page Numbers */}
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                let pageNum: number;
                                if (pagination.totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (pagination.page <= 3) {
                                    pageNum = i + 1;
                                } else if (pagination.page >= pagination.totalPages - 2) {
                                    pageNum = pagination.totalPages - 4 + i;
                                } else {
                                    pageNum = pagination.page - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        disabled={isLoading}
                                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${pageNum === pagination.page
                                                ? 'bg-primary-600 text-white'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages || isLoading}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
