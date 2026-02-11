/**
 * @fileoverview Edit role dialog component.
 * @module features/users/components/EditRoleDialog
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { Dialog } from '@/components/Dialog'
import type { User } from '@/features/auth'

interface EditRoleDialogProps {
    /** Whether the dialog is open */
    open: boolean
    /** Close the dialog */
    onClose: () => void
    /** User to edit */
    user: User | null
    /** Save handler */
    onSave: (userId: string, role: string) => void
    /** Error message */
    saveError?: string | null
}

/**
 * @description Dialog for editing a user's role with radio button selections.
 * @param props - Dialog state and handlers.
 * @returns Dialog element.
 */
export function EditRoleDialog({ open, onClose, user, onSave, saveError }: EditRoleDialogProps) {
    const { t } = useTranslation()
    const [newRole, setNewRole] = useState<'admin' | 'leader' | 'user'>('user')

    // Pre-fill with current role when dialog opens
    useEffect(() => {
        if (user) setNewRole(user.role as any)
    }, [user, open])

    /** Handle save action */
    const handleSave = () => {
        if (!user) return
        onSave(user.id, newRole)
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={t('userManagement.editUserRole')}
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
                        {t('userManagement.saveChanges')}
                    </button>
                </>
            }
        >
            <div className="space-y-4 py-4">
                {/* User info */}
                {user && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                            {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-medium text-slate-900 dark:text-white">{user.displayName || user.email}</div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
                            {user.job_title && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{user.job_title}</div>
                            )}
                            {user.department && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">{user.department}</div>
                            )}
                            {user.mobile_phone && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">{user.mobile_phone}</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Role selection */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {t('userManagement.role')}
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                        {(['admin', 'leader', 'user'] as const).map((role) => (
                            <label
                                key={role}
                                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all
                                    ${newRole === role
                                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-600'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
                            >
                                <input
                                    type="radio"
                                    name="role"
                                    value={role}
                                    checked={newRole === role}
                                    onChange={(e) => setNewRole(e.target.value as any)}
                                    className="sr-only"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900 dark:text-white capitalize">
                                        {role === 'admin' ? t('userManagement.admin') :
                                            role === 'leader' ? t('userManagement.leader') :
                                                t('userManagement.userRole')}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {role === 'admin' ? t('userManagement.adminDescription') :
                                            role === 'leader' ? t('userManagement.leaderDescription') :
                                                t('userManagement.userDescription')}
                                    </div>
                                </div>
                                {newRole === role && (
                                    <div className="w-2 h-2 rounded-full bg-primary-600 ml-2" />
                                )}
                            </label>
                        ))}
                    </div>

                    {/* Error display */}
                    {saveError && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-400">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">{saveError}</div>
                        </div>
                    )}
                </div>
            </div>
        </Dialog>
    )
}
