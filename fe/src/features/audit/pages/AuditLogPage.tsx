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
    RefreshCw,
    User,
    Clock,
    Globe,
    FileText,
    X
} from 'lucide-react';
import { Table, Pagination, Card, Space, Avatar, DatePicker } from 'antd';
import { useFirstVisit, GuidelineDialog } from '@/features/guideline';
import dayjs from 'dayjs';

/** API base URL from environment */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * @description Audit log entry structure received from the API.
 */
interface AuditLogEntry {
    /** Unique identifier for the log entry */
    id: number;
    /** User ID who performed the action (nullable for system actions) */
    user_id: string | null;
    /** Email of the user who performed the action */
    user_email: string;
    /** The type of action performed (e.g., 'login', 'create_user') */
    action: string;
    /** The type of resource affected (e.g., 'user', 'file') */
    resource_type: string;
    /** ID of the affected resource */
    resource_id: string | null;
    /** Additional details about the action (JSON object) */
    details: Record<string, any>;
    /** IP address from where the action originated */
    ip_address: string | null;
    /** Timestamp of the action */
    created_at: string;
}

/**
 * @description Pagination metadata returned by the API.
 */
interface Pagination {
    /** Current page number */
    page: number;
    /** Number of items per page */
    limit: number;
    /** Total number of items available */
    total: number;
    /** Total number of pages */
    totalPages: number;
}

/**
 * @description The shape of the API response for audit logs.
 */
interface AuditLogResponse {
    /** List of audit log entries */
    data: AuditLogEntry[];
    /** Pagination information */
    pagination: Pagination;
}

/**
 * @description State for filtering the audit logs.
 */
interface Filters {
    /** Search term for filtering by text */
    search: string;
    /** Filter by specific action type */
    action: string;
    /** Filter by specific resource type */
    resourceType: string;
    /** Start date for time range filtering */
    startDate: string;
    /** End date for time range filtering */
    endDate: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * @description Format action type for display with specific color coding and labels.
 *
 * @param {string} action - The action identifier (e.g., 'login', 'create_user').
 * @param {any} t - The translation function.
 * @returns {{ label: string; className: string }} Object containing the translated label and CSS classes.
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

        // Prompt
        create_prompt: { label: t('auditLog.actions.create_prompt'), className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
        update_prompt: { label: t('auditLog.actions.update_prompt'), className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
        delete_prompt: { label: t('auditLog.actions.delete_prompt'), className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
    };

    return actionMap[action] || {
        // Fallback formatting for unknown actions
        label: t(`auditLog.actions.${action}`, { defaultValue: action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }),
        className: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
    };
}

/**
 * @description Format resource type for display.
 * Maps raw resource type strings to translated labels.
 *
 * @param {string} type - The resource type string (e.g., 'user', 'file').
 * @param {any} t - The translation function.
 * @returns {string} The localized resource type label.
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
        prompt: t('auditLog.resourceTypes.prompt'),
    };
    return typeMap[type] || t(`auditLog.resourceTypes.${type}`, { defaultValue: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) });
}

/**
 * @description Format date string into a localized string.
 *
 * @param {string} dateString - The ISO date string.
 * @returns {string} Localized date/time string.
 */
function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString();
}

/**
 * @description Format arbitrary details object into a readable string.
 * Filters out null/undefined values and formats keys.
 *
 * @param {Record<string, any>} details - Dictionary of detail values.
 * @returns {string} Formatted string representation of details.
 */
function formatDetails(details: Record<string, any>): string {
    if (!details || Object.keys(details).length === 0) return '-';

    const entries = Object.entries(details)
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([key, value]) => {
            // Convert camelCase or snake_case to human readable format
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
 * @description Audit Log Page Component for administrators.
 * Features include:
 * - Paginated list of all audit logs
 * - Filter by action, resource type, date range
 * - Search in user email and details
 * - Admin-only access (verified client-side)
 *
 * @returns {JSX.Element} The rendered Audit Log page.
 */
export default function AuditLogPage() {
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();

    const { isFirstVisit } = useFirstVisit('audit');
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => {
        if (isFirstVisit) {
            setShowGuide(true);
        }
    }, [isFirstVisit]);

    // Data state for logs and pagination
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
    });
    const [isLoading, setIsLoading] = useState(true);

    // Filter state
    const [filters, setFilters] = useState<Filters>({
        search: '',
        action: '',
        resourceType: '',
        startDate: '',
        endDate: '',
    });
    const [showFilters, setShowFilters] = useState(false);

    // Available filter options fetched from backend
    const [actionTypes, setActionTypes] = useState<string[]>([]);
    const [resourceTypes, setResourceTypes] = useState<string[]>([]);

    // ============================================================================
    // Data Fetching
    // ============================================================================

    /**
     * @description Fetch audit logs with current filters and pagination settings.
     * Constructs the query parameters and updates log state.
     *
     * @param {number} [page=1] - The page number to fetch.
     */
    const fetchLogs = useCallback(async (page: number = 1, limit?: number) => {
        setIsLoading(true);

        try {
            const fetchLimit = limit || pagination.limit;
            // Construct query parameters including filters
            const params = new URLSearchParams({
                page: String(page),
                limit: String(fetchLimit),
            });

            if (filters.search) params.append('search', filters.search);
            if (filters.action) params.append('action', filters.action);
            if (filters.resourceType) params.append('resourceType', filters.resourceType);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            // Fetch data from the audit API
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
            console.error('Failed to fetch audit logs:', err);
        } finally {
            setIsLoading(false);
        }
    }, [filters, pagination.limit, t]);

    /**
     * @description Fetch available filter options (actions and resource types) from the backend.
     * Populates the dropdowns in the filter panel.
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

    /**
     * @description Initial data fetch on mount.
     */
    useEffect(() => {
        fetchLogs(1);
        fetchFilterOptions();
    }, []);

    /**
     * @description Effect to debounce search/filter changes.
     * Prevents excessive API calls when typing or changing filters rapidly.
     */
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLogs(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [filters]);

    // ============================================================================
    // Handlers
    // ============================================================================

    /**
     * @description Handler for pagination page changes.
     *
     * @param {number} newPage - The new page number requested.
     * @param {number} [newPageSize] - The new page size requested.
     */
    const handlePageChange = (newPage: number, newPageSize?: number) => {
        if (newPageSize && newPageSize !== pagination.limit) {
            fetchLogs(1, newPageSize);
        } else {
            fetchLogs(newPage);
        }
    };

    /**
     * @description Handler for updating individual filter fields.
     *
     * @param {keyof Filters} key - The filter field to update.
     * @param {string} value - The new value for the filter.
     */
    const handleFilterChange = (key: keyof Filters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    /**
     * @description Clears all active filters and resets to default state.
     */
    const clearFilters = () => {
        setFilters({
            search: '',
            action: '',
            resourceType: '',
            startDate: '',
            endDate: '',
        });
    };

    /** Check if any filters are currently active */
    const hasActiveFilters = Object.values(filters).some(v => v !== '');

    // ============================================================================
    // Table Columns
    // ============================================================================

    const columns = [
        {
            title: (
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <Clock className="w-3 h-3" />
                    {t('auditLog.timestamp')}
                </div>
            ),
            dataIndex: 'created_at',
            key: 'created_at',
            width: 200,
            render: (text: string) => <span className="whitespace-nowrap">{formatDateTime(text)}</span>,
        },
        {
            title: (
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <User className="w-3 h-3" />
                    {t('auditLog.user')}
                </div>
            ),
            dataIndex: 'user_email',
            key: 'user_email',
            render: (text: string) => (
                <Space>
                    <Avatar size="small" className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                        {text.charAt(0).toUpperCase()}
                    </Avatar>
                    <span className="truncate max-w-[200px]" title={text}>
                        {text}
                    </span>
                </Space>
            ),
        },
        {
            title: <span className="whitespace-nowrap">{t('auditLog.action')}</span>,
            dataIndex: 'action',
            width: 160,
            render: (action: string) => {
                const actionBadge = getActionBadge(action, t);
                return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${actionBadge.className}`}>
                        {actionBadge.label}
                    </span>
                );
            },
        },
        {
            title: <span className="whitespace-nowrap">{t('auditLog.resourceType')}</span>,
            dataIndex: 'resource_type',
            key: 'resource_type',
            width: 180,
            render: (text: string) => <div className="whitespace-nowrap">{formatResourceType(text, t)}</div>,
        },
        {
            title: (
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <FileText className="w-3 h-3" />
                    {t('auditLog.details')}
                </div>
            ),
            dataIndex: 'details',
            key: 'details',
            width: 400,
            render: (details: any) => (
                <div className="whitespace-nowrap truncate max-w-[400px]" title={formatDetails(details)}>
                    {formatDetails(details)}
                </div>
            ),
        },
        {
            title: (
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <Globe className="w-3 h-3" />
                    {t('auditLog.ipAddress')}
                </div>
            ),
            dataIndex: 'ip_address',
            key: 'ip_address',
            render: (text: string) => <span className="font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{text || '-'}</span>,
        },
    ];

    // ============================================================================
    // Render
    // ============================================================================

    // Only allow admins to view this page
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

                    {/* Filter Toggle Button */}
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

                    {/* Refresh Button */}
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
                                <DatePicker
                                    showTime
                                    className="w-full"
                                    value={filters.startDate ? dayjs(filters.startDate) : null}
                                    onChange={(date) => handleFilterChange('startDate', date?.toISOString() || '')}
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
                                    onChange={(date) => handleFilterChange('endDate', date?.toISOString() || '')}
                                    placeholder={t('auditLog.endDate')}
                                    disabledDate={(current) => filters.startDate ? current < dayjs(filters.startDate) : false}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>


            {/* Data Table */}
            <Card
                styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
                className="dark:bg-slate-800 dark:border-slate-700 flex-1 min-h-0 overflow-hidden"
            >
                <div className="flex-1 overflow-auto p-4">
                    <Table
                        columns={columns}
                        dataSource={logs}
                        rowKey="id"
                        loading={isLoading}
                        pagination={false}
                        scroll={{ x: true }}
                    />
                </div>
                <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700">
                    <Pagination
                        current={pagination.page}
                        total={pagination.total}
                        pageSize={pagination.limit}
                        showSizeChanger={true}
                        pageSizeOptions={['10', '20', '25', '50', '100']}
                        onChange={handlePageChange}
                    />
                </div>
            </Card>

            <GuidelineDialog
                open={showGuide}
                onClose={() => setShowGuide(false)}
                featureId="audit"
            />
        </div>
    );
}
