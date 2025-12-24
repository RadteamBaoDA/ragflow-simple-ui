import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Dialog } from '@/components/Dialog';
import { KnowledgeBaseSource, AccessControl } from '@/features/knowledge-base/api/knowledgeBaseService';
import { teamService } from '@/features/teams';
import { userService } from '@/features/users';
import { Check, Search, Users, Shield, User as UserIcon } from 'lucide-react';

interface PermissionsSelectorProps {
    isPublic: boolean;
    setIsPublic: (val: boolean) => void;
    selectedTeamIds: string[];
    setSelectedTeamIds: (ids: string[]) => void;
    selectedUserIds: string[];
    setSelectedUserIds: (ids: string[]) => void;
}

export function PermissionsSelector({
    isPublic,
    setIsPublic,
    selectedTeamIds,
    setSelectedTeamIds,
    selectedUserIds,
    setSelectedUserIds
}: PermissionsSelectorProps) {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch Teams
    const teamsQuery = useQuery({
        queryKey: ['teams'],
        queryFn: () => teamService.getTeams(),
        enabled: !isPublic,
    });

    // Fetch Users
    const usersQuery = useQuery({
        queryKey: ['users', 'permissions'],
        queryFn: () => userService.getAllUsers(['user', 'leader']),
        enabled: !isPublic,
    });

    const toggleTeam = (teamId: string) => {
        setSelectedTeamIds(
            selectedTeamIds.includes(teamId) ? selectedTeamIds.filter(id => id !== teamId) : [...selectedTeamIds, teamId]
        );
    };

    const toggleUser = (userId: string) => {
        setSelectedUserIds(
            selectedUserIds.includes(userId) ? selectedUserIds.filter(id => id !== userId) : [...selectedUserIds, userId]
        );
    };

    const filteredTeams = teamsQuery.data?.filter(team =>
        team.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const filteredUsers = usersQuery.data?.filter(user =>
        (user.displayName || user.email).toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Public Access Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 shrink-0">
                <div>
                    <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <Shield size={18} />
                        {t('knowledgeBaseConfig.publicAccess') || 'System-wide Access'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t('knowledgeBaseConfig.publicAccessDesc') || 'Allow all authenticated users to access this source.'}
                    </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {!isPublic && (
                <div className="flex-1 min-h-0 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-200">
                    {/* Search Filter */}
                    <div className="relative shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder={t('common.searchPlaceholder') || 'Search...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
                        {/* Teams List */}
                        <div className="border rounded-lg dark:border-slate-600 flex flex-col h-full bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
                            <div className="p-3 bg-gray-50 dark:bg-slate-700/50 border-b dark:border-slate-600 font-medium flex items-center gap-2 shrink-0">
                                <Users size={16} className="text-gray-500" />
                                {t('common.teams')}
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                {teamsQuery.isLoading ? (
                                    <div className="p-4 text-center text-gray-500 text-sm italic">{t('common.loading')}</div>
                                ) : teamsQuery.isError ? (
                                    <div className="p-4 text-center text-red-500 text-sm">{t('common.error')}</div>
                                ) : filteredTeams.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 text-sm italic">{t('common.noData')}</div>
                                ) : (
                                    filteredTeams.map(team => (
                                        <div
                                            key={team.id}
                                            onClick={() => toggleTeam(team.id)}
                                            className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-all border ${selectedTeamIds.includes(team.id) ? 'bg-primary-50 border-primary-200 dark:bg-primary-900/20 dark:border-primary-800 text-primary-700 dark:text-primary-300' : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                                        >
                                            <span className="text-sm truncate font-medium">{team.name}</span>
                                            {selectedTeamIds.includes(team.id) && <Check size={16} className="text-primary-600 shrink-0" />}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Users List */}
                        <div className="border rounded-lg dark:border-slate-600 flex flex-col h-full bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
                            <div className="p-3 bg-gray-50 dark:bg-slate-700/50 border-b dark:border-slate-600 font-medium flex items-center gap-2 shrink-0">
                                <UserIcon size={16} className="text-gray-500" />
                                {t('common.users')}
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                {usersQuery.isLoading ? (
                                    <div className="p-4 text-center text-gray-500 text-sm italic">{t('common.loading')}</div>
                                ) : usersQuery.isError ? (
                                    <div className="p-4 text-center text-red-500 text-sm">
                                        {t('common.error')} <br />
                                        <span className="text-xs text-gray-400">Failed to load users</span>
                                    </div>
                                ) : filteredUsers.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 text-sm italic">{t('common.noData')}</div>
                                ) : (
                                    filteredUsers.map(user => (
                                        <div
                                            key={user.id}
                                            onClick={() => toggleUser(user.id)}
                                            className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-all border ${selectedUserIds.includes(user.id) ? 'bg-primary-50 border-primary-200 dark:bg-primary-900/20 dark:border-primary-800 text-primary-700 dark:text-primary-300' : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                                        >
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm truncate font-medium">{user.displayName}</span>
                                                <span className="text-xs text-gray-500 truncate">{user.email}</span>
                                            </div>
                                            {selectedUserIds.includes(user.id) && <Check size={16} className="text-primary-600 shrink-0" />}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

interface SourcePermissionsModalProps {
    open: boolean;
    onClose: () => void;
    source: KnowledgeBaseSource | null;
    onSave: (sourceId: string, accessControl: AccessControl) => void;
}

export function SourcePermissionsModal({ open, onClose, source, onSave }: SourcePermissionsModalProps) {
    const { t } = useTranslation();
    const [isPublic, setIsPublic] = useState(true);
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

    useEffect(() => {
        if (source) {
            const acl = source.access_control || { public: true, team_ids: [], user_ids: [] };
            setIsPublic(acl.public);
            setSelectedTeamIds(acl.team_ids || []);
            setSelectedUserIds(acl.user_ids || []);
        } else {
            setIsPublic(true);
            setSelectedTeamIds([]);
            setSelectedUserIds([]);
        }
    }, [source, open]);

    const handleSave = () => {
        if (!source) return;
        onSave(source.id, {
            public: isPublic,
            team_ids: isPublic ? [] : selectedTeamIds,
            user_ids: isPublic ? [] : selectedUserIds,
        });
        onClose();
    };

    if (!source) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={t('knowledgeBaseConfig.permissionsTitle', { sourceName: source.name }) || `Permissions: ${source.name}`}
            maxWidth="none"
            className="w-[70vw] h-[70vh]"
        >
            <div className="h-full flex flex-col">
                <div className="flex-1 min-h-0">
                    <PermissionsSelector
                        isPublic={isPublic}
                        setIsPublic={setIsPublic}
                        selectedTeamIds={selectedTeamIds}
                        setSelectedTeamIds={setSelectedTeamIds}
                        selectedUserIds={selectedUserIds}
                        setSelectedUserIds={setSelectedUserIds}
                    />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700 shrink-0 mt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md dark:text-gray-300 dark:hover:bg-slate-700"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        {t('common.save')}
                    </button>
                </div>
            </div>
        </Dialog>
    );
}


// Add strict identifier for search reference
export const ComponentName = "SourcePermissionsModal";
