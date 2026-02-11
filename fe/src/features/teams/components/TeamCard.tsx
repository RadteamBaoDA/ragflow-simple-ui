/**
 * @fileoverview Individual team card component.
 * @module features/teams/components/TeamCard
 */
import { useTranslation } from 'react-i18next'
import { Card, Tag, Space, Button, Tooltip, Avatar } from 'antd'
import { Edit, Trash2, Users } from 'lucide-react'
import type { Team } from '../types/team.types'

interface TeamCardProps {
    /** Team data */
    team: Team
    /** Open edit dialog */
    onEdit: (team: Team) => void
    /** Delete team */
    onDelete: (id: string) => void
    /** Open members dialog */
    onManageMembers: (team: Team) => void
}

/**
 * @description Card displaying a single team with leader info and action buttons.
 * @param props - Team data and action handlers.
 * @returns Card element.
 */
export function TeamCard({ team, onEdit, onDelete, onManageMembers }: TeamCardProps) {
    const { t } = useTranslation()

    return (
        <Card
            className="dark:bg-slate-800 dark:border-slate-700 shadow-sm"
            actions={[
                <button
                    key="members"
                    onClick={() => onManageMembers(team)}
                    className="w-full flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-2"
                >
                    <Users size={16} />
                    {t('iam.teams.members')} ({team.member_count || 0})
                </button>
            ]}
            title={
                <div className="flex justify-between items-center w-full">
                    <div className="flex flex-col">
                        <span className="text-lg font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">{team.name}</span>
                        {team.project_name && (
                            <Tag color="blue" className="w-fit mt-1">
                                {team.project_name}
                            </Tag>
                        )}
                    </div>
                    <Space>
                        <Tooltip title={t('iam.teams.edit')}>
                            <Button
                                type="text"
                                icon={<Edit size={18} className="text-slate-400" />}
                                onClick={() => onEdit(team)}
                            />
                        </Tooltip>
                        <Tooltip title={t('common.delete')}>
                            <Button
                                type="text"
                                danger
                                icon={<Trash2 size={18} />}
                                onClick={() => onDelete(team.id)}
                            />
                        </Tooltip>
                    </Space>
                </div>
            }
        >
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
                {team.description || t('common.noDescription')}
            </p>

            {/* Leader Info */}
            {team.leader ? (
                <div className="flex items-center gap-2 mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <Avatar size="small" className="bg-purple-500 text-white">
                        {team.leader.display_name?.charAt(0)?.toUpperCase() || '?'}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-purple-700 dark:text-purple-300 truncate">
                            {team.leader.display_name || 'Leader'}
                        </div>
                        <div className="text-xs text-purple-500 dark:text-purple-400 truncate">
                            {team.leader.email}
                        </div>
                    </div>
                    <Tag color="purple" className="text-xs">{t('iam.teams.leader')}</Tag>
                </div>
            ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">
                    {t('iam.teams.leader')}: -
                </div>
            )}
        </Card>
    )
}
