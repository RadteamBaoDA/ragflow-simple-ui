/**
 * @fileoverview Create/Edit team dialog component.
 * @module features/teams/components/TeamFormDialog
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Space, Button, Input } from 'antd'
import { Dialog } from '@/components/Dialog'
import type { Team, CreateTeamDTO } from '../types/team.types'

interface TeamFormDialogProps {
    /** Whether the dialog is open */
    open: boolean
    /** Close the dialog */
    onClose: () => void
    /** Team to edit (null = create mode) */
    team: Team | null
    /** Callback on successful save */
    onSave: (data: CreateTeamDTO) => Promise<boolean>
}

/**
 * @description Combined create/edit team dialog with name, project name, and description fields.
 * @param props - Dialog state, team to edit, and save callback.
 * @returns Dialog element.
 */
export function TeamFormDialog({ open, onClose, team, onSave }: TeamFormDialogProps) {
    const { t } = useTranslation()
    const [formData, setFormData] = useState({ name: '', project_name: '', description: '' })

    // Populate form when editing, reset when creating
    useEffect(() => {
        if (team) {
            setFormData({
                name: team.name,
                project_name: team.project_name || '',
                description: team.description || '',
            })
        } else {
            setFormData({ name: '', project_name: '', description: '' })
        }
    }, [team, open])

    /** Handle save: call onSave and close on success */
    const handleSave = async () => {
        const success = await onSave(formData)
        if (success) onClose()
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={team ? t('iam.teams.edit') : t('iam.teams.create')}
            maxWidth="xl"
            footer={
                <Space>
                    <Button onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="primary" onClick={handleSave}>
                        {t('common.save')}
                    </Button>
                </Space>
            }
        >
            <div className="space-y-4 py-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t('iam.teams.name')}
                    </label>
                    <Input
                        required
                        value={formData.name}
                        onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
                        className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                        placeholder={t('iam.teams.name')}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t('iam.teams.projectName')}
                    </label>
                    <Input
                        value={formData.project_name}
                        onChange={(e: any) => setFormData({ ...formData, project_name: e.target.value })}
                        className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                        placeholder={t('iam.teams.projectName')}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t('iam.teams.formDescription')}
                    </label>
                    <Input.TextArea
                        rows={4}
                        value={formData.description}
                        onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
                        className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                        placeholder={t('iam.teams.formDescription')}
                    />
                </div>
            </div>
        </Dialog>
    )
}
