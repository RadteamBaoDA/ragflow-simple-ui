/**
 * @fileoverview Utility helpers and badge component for audit action display.
 * Extracts formatting logic from AuditLogPage for reuse in table cells.
 * @module features/audit/components/AuditActionBadge
 */
import { useTranslation } from 'react-i18next'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * @description Get action badge config (label + CSS classes) for a given action.
 * @param action - The action identifier (e.g., 'login', 'create_user').
 * @param t - The i18n translation function.
 * @returns Object with translated label and Tailwind CSS classes.
 */
export function getActionBadge(action: string, t: (key: string, opts?: any) => string): { label: string; className: string } {
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
    }

    return actionMap[action] || {
        label: t(`auditLog.actions.${action}`, { defaultValue: action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }),
        className: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
    }
}

/**
 * @description Format resource type for display using i18n.
 * @param type - The resource type string.
 * @param t - The i18n translation function.
 * @returns Localized resource type label.
 */
export function formatResourceType(type: string, t: (key: string, opts?: any) => string): string {
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
    }
    return typeMap[type] || t(`auditLog.resourceTypes.${type}`, { defaultValue: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) })
}

/**
 * @description Format ISO date string into a localized string.
 * @param dateString - The ISO date string.
 * @returns Localized date/time string.
 */
export function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString()
}

/**
 * @description Format details object into a human-readable string.
 * @param details - Dictionary of detail values.
 * @returns Formatted string representation.
 */
export function formatDetails(details: Record<string, any>): string {
    if (!details || Object.keys(details).length === 0) return '-'

    const entries = Object.entries(details)
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([key, value]) => {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
            const formattedValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
            return `${formattedKey}: ${formattedValue}`
        })

    return entries.join(', ')
}

// ============================================================================
// Component
// ============================================================================

/**
 * @description Renders an action type as a colored badge.
 * @param props
 * @param props.action - The action identifier string.
 * @returns Badge element.
 */
export function AuditActionBadge({ action }: { action: string }) {
    const { t } = useTranslation()
    const badge = getActionBadge(action, t)

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.className}`}>
            {badge.label}
        </span>
    )
}
