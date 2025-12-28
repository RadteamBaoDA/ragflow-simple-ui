import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/Dialog';
import { teamService } from '@/features/teams';
import { userService } from '@/features/users';
import { getAllPermissions, setPermission, PermissionLevel } from '../api/minioService';
import { Search, Users, User as UserIcon } from 'lucide-react';
import { Table, Select as AntSelect, Space, Input, Avatar, Tabs, Button } from 'antd';

/**
 * @description Props for DocumentPermissionModal.
 */
interface DocumentPermissionModalProps {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Callback to close the modal */
    onClose: () => void;
    /** ID of the bucket to manage permissions for */
    bucketId?: string;
    /** Display name of the bucket */
    bucketName?: string;
}

/**
 * @description Modal allowing admins/owners to configure read/write access levels
 * for users and teams on a specific MinIO bucket.
 */
export function DocumentPermissionModal({ isOpen, onClose, bucketId, bucketName }: DocumentPermissionModalProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'teams'>('users');
    const [pendingChanges, setPendingChanges] = useState<Record<string, { type: 'user' | 'team', level: number }>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Fetch Lists
    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => teamService.getTeams(),
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users', 'permissions'],
        queryFn: () => userService.getAllUsers(['leader']),
    });

    // Fetch Active Permissions
    const { data: permissions = [], isLoading: isLoadingPerms } = useQuery({
        queryKey: ['document-permissions', bucketId],
        queryFn: () => getAllPermissions(bucketId),
        enabled: isOpen,
    });

    const getLevel = (type: 'user' | 'team', id: string) => {
        const key = `${type}:${id}`;
        if (pendingChanges[key]) return pendingChanges[key].level;

        const perm = permissions.find(p => (p as any).entity_type === type && (p as any).entity_id === id);
        return perm ? (perm as any).permission_level : PermissionLevel.NONE;
    };

    const handleLevelChange = (type: 'user' | 'team', id: string, newLevel: number) => {
        const key = `${type}:${id}`;
        setPendingChanges(prev => ({
            ...prev,
            [key]: { type, level: newLevel }
        }));
    };

    const handleSave = async () => {
        if (!bucketId || Object.keys(pendingChanges).length === 0) return;

        setIsSaving(true);
        try {
            for (const key of Object.keys(pendingChanges)) {
                const change = pendingChanges[key];
                if (!change) continue;

                const { type, level } = change;
                const entityId = key.split(':')[1];
                if (!entityId) continue;

                await setPermission(type, entityId, bucketId, level);
            }
            queryClient.invalidateQueries({ queryKey: ['document-permissions', bucketId] });
            queryClient.invalidateQueries({ queryKey: ['minio-permissions', bucketId] });
            setPendingChanges({});
            onClose();
        } catch (error) {
            console.error('Failed to save permissions', error);
        } finally {
            setIsSaving(false);
        }
    };

    const levels = [
        { value: PermissionLevel.NONE, label: t('documents.permissionLevels.none'), color: 'text-gray-500' },
        { value: PermissionLevel.VIEW, label: t('documents.permissionLevels.view'), color: 'text-blue-600' },
        { value: PermissionLevel.UPLOAD, label: t('documents.permissionLevels.upload'), color: 'text-green-600' },
        { value: PermissionLevel.FULL, label: t('documents.permissionLevels.full'), color: 'text-purple-600 font-semibold' },
    ];

    const filteredUsers = users.filter(user =>
        ((user.displayName || user.email) || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredTeams = teams.filter(team =>
        team.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns = [
        {
            title: activeTab === 'users' ? t('common.user') : t('common.team'),
            key: 'entity',
            render: (_: any, record: any) => {
                const isUser = activeTab === 'users';
                return (
                    <div className="flex items-center gap-3">
                        {isUser ? (
                            <Avatar className="bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                                {(record.displayName && record.displayName[0]) || (record.email && record.email[0] ? record.email[0].toUpperCase() : '?')}
                            </Avatar>
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Users size={16} />
                            </div>
                        )}
                        <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                                {isUser ? (record.displayName || record.email) : record.name}
                            </div>
                            {isUser && (
                                <div className="text-xs text-gray-500">
                                    {record.email}
                                </div>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            title: t('common.permissions'),
            key: 'permissions',
            width: 250,
            align: 'right' as const,
            render: (_: any, record: any) => {
                const currentLevel = getLevel(activeTab === 'users' ? 'user' : 'team', record.id);
                return (
                    <div className="flex flex-col items-end">
                        <AntSelect
                            value={currentLevel}
                            onChange={(val) => handleLevelChange(activeTab === 'users' ? 'user' : 'team', record.id, val)}
                            className="w-48"
                            options={levels.map(lvl => ({ value: lvl.value, label: lvl.label }))}
                        />
                        {activeTab === 'teams' && (
                            <div className="text-[10px] text-gray-400 mt-1">
                                {t('documents.permissionLevels.appliesToLeaders')}
                            </div>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            title={`${t('documents.configPermissions') || 'Storage Permissions'}${bucketName ? `: ${bucketName}` : ''}`}
            maxWidth="none"
            className="w-[70%]"
            footer={
                <Space>
                    <Button onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        type="primary"
                        loading={isSaving}
                        disabled={isSaving || Object.keys(pendingChanges).length === 0}
                        onClick={handleSave}
                        className="bg-gradient-to-r from-primary-500 to-primary-600"
                    >
                        {t('common.save')}
                    </Button>
                </Space>
            }
        >
            <div className="flex flex-col h-[600px] w-full">
                <div className="mb-4">
                    <Input
                        prefix={<Search className="text-gray-400" size={16} />}
                        placeholder={t('common.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="dark:bg-slate-800 dark:border-slate-600"
                    />
                </div>

                <Tabs
                    activeKey={activeTab}
                    onChange={(key: any) => setActiveTab(key)}
                    items={[
                        {
                            key: 'users',
                            label: (
                                <span className="flex items-center gap-2">
                                    <UserIcon size={16} />
                                    {t('common.users')}
                                </span>
                            ),
                        },
                        {
                            key: 'teams',
                            label: (
                                <span className="flex items-center gap-2">
                                    <Users size={16} />
                                    {t('common.teams')}
                                </span>
                            ),
                        },
                    ]}
                    className="mb-4"
                />

                <div className="flex-1 overflow-hidden">
                    <Table
                        columns={columns}
                        dataSource={activeTab === 'users' ? filteredUsers : filteredTeams}
                        rowKey="id"
                        loading={isLoadingPerms}
                        size="small"
                        pagination={false}
                        scroll={{ y: 400 }}
                        locale={{ emptyText: t('common.noData') }}
                    />
                </div>
            </div>
        </Dialog>
    );
}
