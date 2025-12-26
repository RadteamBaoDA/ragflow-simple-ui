/**
 * @fileoverview Team management page.
 * 
 * Provides functionalities for:
 * - Listing all teams.
 * - Creating, updating, and deleting teams.
 * - Managing team members (adding/removing users).
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, Users, Search } from 'lucide-react';
import { globalMessage } from '@/app/App';
import { teamService, Team, TeamMember } from '../api/teamService';
import { userService } from '@/features/users';
import { User } from '@/features/auth';
import UserMultiSelect from '@/features/users/components/UserMultiSelect';
import { useConfirm } from '@/components/ConfirmDialog';
import { Dialog } from '@/components/Dialog';

export default function TeamManagementPage() {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

    const [formData, setFormData] = useState({ name: '', project_name: '', description: '' });

    const [users, setUsers] = useState<User[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [addMemberError, setAddMemberError] = useState<string | null>(null);

    const dataFetchedRef = useRef(false);

    useEffect(() => {
        if (dataFetchedRef.current) return;
        dataFetchedRef.current = true;
        loadTeams();
        // loadUsers(); // Optimization: Load users only when needed (opening members modal)
    }, []);

    /**
     * Fetch all users from the backend.
     * Used for populating the add member dropdown.
     */
    const loadUsers = async () => {
        try {
            const data = await userService.getUsers();
            setUsers(data);
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    };

    /**
     * Fetch all teams.
     */
    const loadTeams = async () => {
        try {
            setLoading(true);
            const data = await teamService.getTeams();
            setTeams(data);
        } catch (error) {
            console.error('Failed to load teams:', error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Fetch members for a specific team.
     * @param teamId - ID of the team
     */
    const loadMembers = async (teamId: string) => {
        try {
            const data = await teamService.getTeamMembers(teamId);
            setMembers(data);
        } catch (error) {
            console.error('Failed to load members:', error);
        }
    };

    /**
     * Close all modals and reset form state.
     */
    const closeModals = () => {
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
        setIsMembersModalOpen(false);

        setFormData({ name: '', project_name: '', description: '' });
        setSelectedTeam(null);
        setSelectedUserIds([]);
        setAddMemberError(null);
    };

    /**
     * Handle team creation.
     */
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await teamService.createTeam(formData);
            globalMessage.success(t('common.createSuccess'));
            closeModals();
            loadTeams();
        } catch (error) {
            console.error('Failed to create team:', error);
        }
    };

    /**
     * Handle team update.
     */
    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTeam) return;
        try {
            await teamService.updateTeam(selectedTeam.id, formData);
            globalMessage.success(t('common.updateSuccess'));
            closeModals();
            loadTeams();
        } catch (error) {
            console.error('Failed to update team:', error);
        }
    };

    /**
     * Handle team deletion.
     * @param id - Team ID
     */
    const handleDelete = async (id: string) => {
        const confirmed = await confirm({ message: t('common.confirmDelete'), variant: 'danger' });
        if (!confirmed) return;
        try {
            await teamService.deleteTeam(id);
            globalMessage.success(t('common.deleteSuccess'));
            loadTeams();
        } catch (error) {
            console.error('Failed to delete team:', error);
        }
    };

    /**
     * Add selected users as members to the current team.
     */
    const handleAddMember = async () => {
        setAddMemberError(null);
        if (!selectedTeam || selectedUserIds.length === 0) return;
        try {
            await teamService.addMembers(selectedTeam.id, selectedUserIds);
            globalMessage.success(t('iam.teams.addMemberSuccess'));
            setSelectedUserIds([]);
            loadMembers(selectedTeam.id);
        } catch (error) {
            console.error('Failed to add member:', error);
            setAddMemberError(error instanceof Error ? error.message : t('iam.teams.addMemberError'));
        }
    };



    const openEditModal = (team: Team) => {
        setSelectedTeam(team);
        setFormData({
            name: team.name,
            project_name: team.project_name || '',
            description: team.description || ''
        });
        setIsEditModalOpen(true);
    };

    const openMembersModal = (team: Team) => {
        setSelectedTeam(team);
        loadMembers(team.id);
        if (users.length === 0) {
            loadUsers();
        }
        setIsMembersModalOpen(true);
    };

    const filteredTeams = teams.filter(team =>
        team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const availableUsers = users.filter(user =>
        (user.role === 'user' || user.role === 'leader') &&
        !members.some(member => member.id === user.id)
    );

    return (
        <div className="h-full flex flex-col p-6 max-w-7xl mx-auto">
            <div className="flex-none">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('iam.teams.title')}</h1>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('iam.teams.description')}</p>
                    </div>
                    <button
                        onClick={() => {
                            setFormData({ name: '', project_name: '', description: '' });
                            setIsCreateModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={20} />
                        {t('iam.teams.create')}
                    </button>
                </div>

                <div className="mb-6 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder={t('common.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTeams.map(team => (
                            <div key={team.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{team.name}</h3>
                                        {team.project_name && (
                                            <span className="text-xs font-medium px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
                                                {team.project_name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEditModal(team)}
                                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                            title={t('iam.teams.edit')}
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(team.id)}
                                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                            title={t('common.delete')}
                                        >
                                            <Trash2 size={18} />
                                        </button>

                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex-1">
                                    {team.description || t('common.noDescription')}
                                </p>
                                <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-auto">
                                    <button
                                        onClick={() => openMembersModal(team)}
                                        className="w-full flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                    >
                                        <Users size={16} />
                                        {t('iam.teams.members')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            <Dialog
                open={isCreateModalOpen || isEditModalOpen}
                onClose={closeModals}
                title={isCreateModalOpen ? t('iam.teams.create') : t('iam.teams.edit')}
                maxWidth="xl"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={closeModals}
                            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={() => {
                                const e = { preventDefault: () => { } } as React.FormEvent;
                                isCreateModalOpen ? handleCreate(e) : handleUpdate(e);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            {t('common.save')}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {t('iam.teams.name')}
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {t('iam.teams.projectName')}
                        </label>
                        <input
                            type="text"
                            value={formData.project_name}
                            onChange={e => setFormData({ ...formData, project_name: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {t('iam.teams.formDescription')}
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                        />
                    </div>
                </div>
            </Dialog>

            {/* Members Modal */}
            <Dialog
                open={isMembersModalOpen && !!selectedTeam}
                onClose={closeModals}
                title={`${t('iam.teams.members')} - ${selectedTeam?.name}`}
                maxWidth="3xl"
                className="h-[600px]"
            >
                <div className="h-full flex flex-col">
                    {/* Add Member Section */}
                    <div className="mb-6 flex gap-2 items-start shrink-0">
                        <div className="flex-1">
                            <UserMultiSelect
                                users={availableUsers}
                                selectedUserIds={selectedUserIds}
                                onChange={setSelectedUserIds}
                                placeholder={t('iam.teams.selectUser')}
                            />
                        </div>
                        <button
                            onClick={handleAddMember}
                            disabled={selectedUserIds.length === 0}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-[42px] mt-1"
                        >
                            <Plus size={18} />
                            {t('common.add')}
                        </button>
                    </div>

                    {/* Inline Error Message */}
                    {addMemberError && (
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm shrink-0">
                            {addMemberError}
                        </div>
                    )}

                    <div className="flex-1 overflow-auto border dark:border-slate-700 rounded-lg">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('userManagement.user')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('iam.teams.role')}</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-400">
                                {members.map(member => (
                                    <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-4 py-3 text-sm">
                                            <div className="font-medium text-slate-900 dark:text-white">{member.display_name}</div>
                                            <div className="text-xs text-slate-500">{member.email}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${member.role === 'leader' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                {t(`iam.teams.${member.role}`)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm">
                                            <button
                                                onClick={async () => {
                                                    const confirmed = await confirm({ message: t('common.confirmDelete'), variant: 'danger' });
                                                    if (confirmed && selectedTeam) {
                                                        await teamService.removeMember(selectedTeam.id, member.id);
                                                        globalMessage.success(t('iam.teams.removeMemberSuccess'));
                                                        loadMembers(selectedTeam.id);
                                                    }
                                                }}
                                                className="text-red-600 hover:text-red-900 font-medium"
                                            >
                                                {t('common.delete')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {members.length === 0 && (
                            <div className="text-center py-12 text-slate-500 italic">
                                {t('common.noData')}
                            </div>
                        )}
                    </div>
                </div>
            </Dialog>

        </div>
    );
}
