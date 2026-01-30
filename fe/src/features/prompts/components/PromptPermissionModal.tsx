import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, User, Shield, Check, X, AlertCircle } from 'lucide-react';
import { Modal, Table, Select, Button, Space, Tabs } from 'antd';
import { promptService } from '../api/promptService';
import { globalMessage } from '@/app/App';

interface PermissionRecord {
    id: string;
    entity_type: 'user' | 'team';
    entity_id: string;
    permission_level: number;
}

interface PromptPermissionModalProps {
    open: boolean;
    onClose: () => void;
}

interface UserRecord {
    id: string;
    display_name?: string;
    email: string;
}

interface TeamRecord {
    id: string;
    name: string;
}

export const PromptPermissionModal = ({ open, onClose }: PromptPermissionModalProps) => {
    const { t } = useTranslation();
    const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [teams, setTeams] = useState<TeamRecord[]>([]);
    const [activeTab, setActiveTab] = useState('teams');

    // Add new permission state
    const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
    const [selectedLevel, setSelectedLevel] = useState<number>(1);

    useEffect(() => {
        if (open) {
            fetchPermissions();
            fetchEntities();
        }
    }, [open]);

    const fetchPermissions = async () => {
        setLoading(true);
        try {
            const data = await promptService.getPermissions();
            setPermissions(data);
        } catch (error) {
            console.error(error);
            globalMessage.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const fetchEntities = async () => {
        try {
            const usersRes = await fetch('/api/users', { credentials: 'include' });
            const teamsRes = await fetch('/api/teams', { credentials: 'include' });
            if (usersRes.ok) setUsers(await usersRes.json());
            if (teamsRes.ok) setTeams(await teamsRes.json());
        } catch (error) {
            console.error(error);
        }
    };

    const handleSave = async (entityType: 'user' | 'team', entityId: string, level: number) => {
        try {
            await promptService.setPermission(entityType, entityId, level);
            globalMessage.success(t('common.saveSuccess'));
            fetchPermissions();
        } catch (error) {
            console.error(error);
            globalMessage.error(t('common.error'));
        }
    };

    const getEntityName = (id: string, type: 'user' | 'team') => {
        if (type === 'user') {
            const u = users.find(u => u.id === id);
            return u ? (u.display_name ? `${u.email} - ${u.display_name}` : u.email) : id;
        } else {
            const t = teams.find(t => t.id === id);
            return t ? t.name : id;
        }
    };

    const columns = [
        {
            title: t('common.entity'),
            key: 'name',
            render: (_: any, record: PermissionRecord) => (
                <Space>
                    {record.entity_type === 'user' ? <User size={16} className="text-blue-500" /> : <Users size={16} className="text-purple-500" />}
                    <span>{getEntityName(record.entity_id, record.entity_type)}</span>
                </Space>
            )
        },
        {
            title: t('common.permission'),
            dataIndex: 'permission_level',
            key: 'permission',
            render: (level: number, record: PermissionRecord) => (
                <Select
                    value={level}
                    onChange={(val: number) => handleSave(record.entity_type, record.entity_id, val)}
                    style={{ width: 120 }}
                    options={[
                        { value: 0, label: t('common.none') },
                        { value: 1, label: t('common.view') },
                        { value: 2, label: t('common.edit') },
                        { value: 3, label: t('common.all') },
                    ]}
                />
            )
        },
        {
            title: t('common.actions'),
            key: 'actions',
            render: (_: any, record: PermissionRecord) => (
                <Button
                    type="text"
                    danger
                    icon={<X size={16} />}
                    onClick={() => handleSave(record.entity_type, record.entity_id, 0)}
                />
            )
        }
    ];

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <Shield size={20} className="text-primary" />
                    <span>{t('prompts.permissions.title', 'Prompt Permissions')}</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={700}
        >
            <div className="space-y-6 py-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3">
                    <AlertCircle className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-semibold">{t('prompts.permissions.leaderNoteTitle', 'Leader Permissions')}</p>
                        <p>{t('prompts.permissions.leaderNote', 'Granting permissions to a Team will apply those permissions to all Leaders of that team.')}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Select
                        showSearch
                        placeholder={t('prompts.permissions.selectEntity', 'Select User or Team')}
                        style={{ flex: 1 }}
                        value={selectedEntity}
                        onChange={setSelectedEntity}
                        filterOption={(input: string, option: any) => {
                            if (option?.email) {
                                return option.email.toLowerCase().includes(input.toLowerCase());
                            }
                            return String(option?.label ?? '').toLowerCase().includes(input.toLowerCase());
                        }}
                        options={[
                            {
                                label: t('common.teams'),
                                options: teams.map(t => ({ label: t.name, value: `team:${t.id}` }))
                            },
                            {
                                label: t('common.users'),
                                options: users.map(u => ({
                                    label: `${u.email}${u.display_name ? ` - ${u.display_name}` : ''}`,
                                    value: `user:${u.id}`,
                                    email: u.email
                                }))
                            }
                        ]}
                    />
                    <Select
                        value={selectedLevel}
                        onChange={setSelectedLevel}
                        style={{ width: 120 }}
                        options={[
                            { value: 1, label: t('common.view') },
                            { value: 2, label: t('common.edit') },
                            { value: 3, label: t('common.all') },
                        ]}
                    />
                    <Button
                        type="primary"
                        icon={<Check size={16} />}
                        disabled={!selectedEntity}
                        onClick={() => {
                            if (selectedEntity && selectedEntity.includes(':')) {
                                const [type, id] = selectedEntity.split(':');
                                if (id) {
                                    handleSave(type as 'user' | 'team', id, selectedLevel);
                                    setSelectedEntity(null);
                                }
                            }
                        }}
                    >
                        {t('common.add')}
                    </Button>
                </div>

                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        {
                            key: 'teams',
                            label: (
                                <Space>
                                    <Users size={16} />
                                    {t('common.teams')}
                                </Space>
                            ),
                            children: (
                                <Table
                                    size="small"
                                    columns={columns}
                                    dataSource={permissions.filter(p => p.entity_type === 'team' && p.permission_level > 0)}
                                    rowKey="entity_id"
                                    loading={loading}
                                    pagination={{ pageSize: 5 }}
                                />
                            )
                        },
                        {
                            key: 'users',
                            label: (
                                <Space>
                                    <User size={16} />
                                    {t('common.users')}
                                </Space>
                            ),
                            children: (
                                <Table
                                    size="small"
                                    columns={columns}
                                    dataSource={permissions.filter(p => p.entity_type === 'user' && p.permission_level > 0)}
                                    rowKey="entity_id"
                                    loading={loading}
                                    pagination={{ pageSize: 5 }}
                                />
                            )
                        }
                    ]}
                />
            </div>
        </Modal >
    );
};
