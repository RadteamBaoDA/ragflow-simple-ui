/**
 * @fileoverview Team members management dialog component.
 * @module features/teams/components/TeamMembersDialog
 */
import { useTranslation } from 'react-i18next'
import { Table, Tag, Button, Avatar } from 'antd'
import { Plus } from 'lucide-react'
import { Dialog } from '@/components/Dialog'
import UserMultiSelect from '@/features/users/components/UserMultiSelect'
import type { Team, TeamMember } from '../types/team.types'
import type { User } from '@/features/auth'

interface TeamMembersDialogProps {
    /** Whether the dialog is open */
    open: boolean
    /** Close the dialog */
    onClose: () => void
    /** The team being managed */
    team: Team | null
    /** Current team members */
    members: TeamMember[]
    /** Users available to add */
    availableUsers: User[]
    /** Currently selected user IDs */
    selectedUserIds: string[]
    /** Update selected user IDs */
    onSelectedUserIdsChange: (ids: string[]) => void
    /** Add selected users as members */
    onAddMembers: () => void
    /** Remove a member */
    onRemoveMember: (userId: string) => void
    /** Error message from add operation */
    addMemberError: string | null
}

/**
 * @description Dialog for managing team members: adding and removing users.
 * @param props - Dialog state, member data, and action handlers.
 * @returns Dialog element.
 */
export function TeamMembersDialog({
    open,
    onClose,
    team,
    members,
    availableUsers,
    selectedUserIds,
    onSelectedUserIdsChange,
    onAddMembers,
    onRemoveMember,
    addMemberError,
}: TeamMembersDialogProps) {
    const { t } = useTranslation()

    /** Table columns for member list */
    const memberColumns = [
        {
            title: t('userManagement.user'),
            key: 'user',
            render: (_: any, record: TeamMember) => (
                <div className="flex items-center gap-3">
                    <Avatar className="bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                        {(record.display_name || record.email || '?').charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                        <div className="font-medium text-slate-900 dark:text-white">{record.display_name}</div>
                        <div className="text-xs text-slate-500">{record.email}</div>
                    </div>
                </div>
            ),
        },
        {
            title: t('iam.teams.role'),
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => (
                <Tag color={role === 'leader' ? 'purple' : 'default'} className="capitalize">
                    {t(`iam.teams.${role}`)}
                </Tag>
            ),
        },
        {
            title: t('common.actions'),
            key: 'actions',
            align: 'right' as const,
            render: (_: any, record: TeamMember) => (
                <Button
                    type="text"
                    danger
                    onClick={() => onRemoveMember(record.id)}
                >
                    {t('common.delete')}
                </Button>
            ),
        },
    ]

    return (
        <Dialog
            open={open && !!team}
            onClose={onClose}
            title={`${t('iam.teams.members')} - ${team?.name}`}
            maxWidth="3xl"
        >
            <div className="h-full flex flex-col min-h-[400px]">
                {/* Add member controls */}
                <div className="mb-6 flex gap-2 items-start shrink-0">
                    <div className="flex-1">
                        <UserMultiSelect
                            users={availableUsers}
                            selectedUserIds={selectedUserIds}
                            onChange={onSelectedUserIdsChange}
                            placeholder={t('iam.teams.selectUser')}
                        />
                    </div>
                    <Button
                        type="primary"
                        onClick={onAddMembers}
                        disabled={selectedUserIds.length === 0}
                        icon={<Plus size={18} />}
                        className="h-[42px] mt-1"
                    >
                        {t('common.add')}
                    </Button>
                </div>

                {/* Error message */}
                {addMemberError && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm shrink-0">
                        {addMemberError}
                    </div>
                )}

                {/* Members table */}
                <div className="flex-1 overflow-auto">
                    <Table
                        columns={memberColumns}
                        dataSource={members}
                        rowKey="id"
                        size="small"
                        pagination={false}
                        scroll={{ y: 350 }}
                        locale={{ emptyText: t('common.noData') }}
                    />
                </div>
            </div>
        </Dialog>
    )
}
