import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/Dialog';
import { teamService } from '@/features/teams';
import { userService } from '@/features/users';
import { getAllPermissions, setPermission, PermissionLevel } from '../api/minioService';
import { Search, Users, User as UserIcon, Loader2 } from 'lucide-react';

interface DocumentPermissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    bucketId?: string;
    bucketName?: string;
}

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

    // Helper: Get current level for an entity
    const getLevel = (type: 'user' | 'team', id: string) => {
        const key = `${type}:${id}`;
        if (pendingChanges[key]) return pendingChanges[key].level;

        const perm = permissions.find(p => p.entity_type === type && p.entity_id === id);
        return perm ? perm.permission_level : PermissionLevel.NONE;
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
        (user.displayName || user.email).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredTeams = teams.filter(team =>
        team.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            title={`${t('documents.configPermissions') || 'Storage Permissions'}${bucketName ? `: ${bucketName}` : ''}`}
            maxWidth="none"
            className="w-[70%]"
            footer={
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-600 dark:hover:bg-slate-700"
                    >
                        {t('common.cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || Object.keys(pendingChanges).length === 0}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 rounded-md shadow-lg shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700 hover:shadow-xl hover:shadow-primary-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {isSaving && <Loader2 className="animate-spin" size={16} />}
                        {t('common.save') || 'Save'}
                    </button>
                </div>
            }
        >
            <div className="flex flex-col h-[600px] w-full">
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder={t('common.searchPlaceholder') || 'Search...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                    <button
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'users'
                            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                        onClick={() => setActiveTab('users')}
                    >
                        <UserIcon size={16} />
                        {t('common.users') || 'Users'}
                    </button>
                    <button
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'teams'
                            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                        onClick={() => setActiveTab('teams')}
                    >
                        <Users size={16} />
                        {t('common.teams') || 'Teams'}
                    </button>
                </div>

                {isLoadingPerms ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="animate-spin text-primary-500" size={32} />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-slate-800/50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                                        {activeTab === 'users' ? (t('common.user') || 'User') : (t('common.team') || 'Team')}
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-64 text-right">
                                        {t('common.permissions') || 'Access Level'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                {activeTab === 'users' ? (
                                    filteredUsers.map(user => {
                                        const currentLevel = getLevel('user', user.id);
                                        return (
                                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 text-sm font-medium">
                                                            {(user.displayName && user.displayName[0]) || (user.email && user.email[0] ? user.email[0].toUpperCase() : '?')}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-900 dark:text-white">
                                                                {user.displayName || user.email}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {user.email}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <select
                                                        value={currentLevel}
                                                        onChange={(e) => handleLevelChange('user', user.id, Number(e.target.value))}
                                                        className="px-3 py-1.5 text-sm border rounded-md dark:bg-slate-800 dark:border-slate-600 focus:ring-2 focus:ring-primary-500"
                                                    >
                                                        {levels.map(lvl => (
                                                            <option key={lvl.value} value={lvl.value}>
                                                                {lvl.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    filteredTeams.map(team => {
                                        const currentLevel = getLevel('team', team.id);
                                        return (
                                            <tr key={team.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                            <Users size={16} />
                                                        </div>
                                                        <span className="font-medium text-gray-900 dark:text-white">
                                                            {team.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <select
                                                        value={currentLevel}
                                                        onChange={(e) => handleLevelChange('team', team.id, Number(e.target.value))}
                                                        className="px-3 py-1.5 text-sm border rounded-md dark:bg-slate-800 dark:border-slate-600 focus:ring-2 focus:ring-primary-500"
                                                    >
                                                        {levels.map(lvl => (
                                                            <option key={lvl.value} value={lvl.value}>
                                                                {lvl.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="text-[10px] text-gray-400 mt-1">
                                                        {t('documents.permissionLevels.appliesToLeaders')}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Dialog>
    );
}
