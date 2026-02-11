/**
 * @fileoverview Grant permissions dialog component.
 * @module features/users/components/GrantPermissionsDialog
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '@/components/Dialog'
import type { User } from '@/features/auth'

interface GrantPermissionsDialogProps {
    /** Whether the dialog is open */
    open: boolean
    /** Close the dialog */
    onClose: () => void
    /** User to grant permissions */
    user: User | null
    /** Save handler */
    onSave: (userId: string, permissions: string[]) => void
}

/**
 * @description Dialog for granting checkbox-based permissions to a user.
 * @param props - Dialog state and handlers.
 * @returns Dialog element.
 */
export function GrantPermissionsDialog({ open, onClose, user, onSave }: GrantPermissionsDialogProps) {
    const { t } = useTranslation()
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])

    // Pre-fill with user's current permissions
    useEffect(() => {
        if (user) setSelectedPermissions(user.permissions || [])
    }, [user, open])

    /** Toggle a permission checkbox */
    const togglePermission = (permId: string, checked: boolean) => {
        if (checked) {
            setSelectedPermissions(prev => [...prev, permId])
        } else {
            setSelectedPermissions(prev => prev.filter(p => p !== permId))
        }
    }

    /** Handle save action */
    const handleSave = () => {
        if (!user) return
        onSave(user.id, selectedPermissions)
    }

    /** Available permission definitions */
    const permissionDefs = [
        { id: 'view_chat', label: t('userManagement.permissionLabels.view_chat') },
        { id: 'view_search', label: t('userManagement.permissionLabels.view_search') },
        { id: 'manage_knowledge', label: t('userManagement.permissionLabels.manage_knowledge') },
        { id: 'manage_users', label: t('userManagement.permissionLabels.manage_users') },
        { id: 'view_system_monitor', label: t('userManagement.permissionLabels.view_system_monitor') },
    ]

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={t('userManagement.grantPermissions')}
            maxWidth="2xl"
            footer={
                <>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
                    >
                        {t('common.save')}
                    </button>
                </>
            }
        >
            <div className="py-4 space-y-4">
                {/* User info */}
                {user && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                            {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-medium text-slate-900 dark:text-white">{user.displayName || user.email}</div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
                        </div>
                    </div>
                )}

                {/* Permission checkboxes */}
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t('userManagement.permissions')}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {permissionDefs.map((perm) => (
                            <label key={perm.id} className="flex items-center p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                    checked={selectedPermissions.includes(perm.id)}
                                    onChange={(e) => togglePermission(perm.id, e.target.checked)}
                                />
                                <span className="ml-2 text-sm text-slate-700 dark:text-slate-300">{perm.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </Dialog>
    )
}
