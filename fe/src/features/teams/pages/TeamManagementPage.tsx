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
import { createPortal } from 'react-dom';
import { Table, Tag, Card, Space, Button, Input, Select, Tooltip, Avatar, Pagination } from 'antd';
import { Plus, Edit, Trash2, Users, Search } from 'lucide-react';
import { globalMessage } from '@/app/App';
import { teamService, Team, TeamMember } from '../api/teamService';
import { userService } from '@/features/users';
import { User } from '@/features/auth';
import UserMultiSelect from '@/features/users/components/UserMultiSelect';
import { useConfirm } from '@/components/ConfirmDialog';
import { Dialog } from '@/components/Dialog';
import { useFirstVisit, GuidelineDialog } from '@/features/guideline';

export default function TeamManagementPage() {
    const { t } = useTranslation();

    const { isFirstVisit } = useFirstVisit('iam');
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => {
        if (isFirstVisit) {
            setShowGuide(true);
        }
    }, [isFirstVisit]);

    const confirm = useConfirm();
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [projectFilter, setProjectFilter] = useState('ALL');
    const [users, setUsers] = useState<User[]>([]);

    const handleSearch = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    const handleProjectFilter = (value: string) => {
        setProjectFilter(value);
        setCurrentPage(1);
    };

    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

    const [formData, setFormData] = useState({ name: '', project_name: '', description: '' });

    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [addMemberError, setAddMemberError] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const dataFetchedRef = useRef(false);

    useEffect(() => {
        if (dataFetchedRef.current) return;
        dataFetchedRef.current = true;
        loadTeams();
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
            // Add cache-busting timestamp to ensure fresh data
            const data = await teamService.getTeams();
            setTeams(data || []);
        } catch (error) {
            console.error('Failed to load teams:', error);
            setTeams([]);
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
        setIsMembersModalOpen(false);

        setFormData({ name: '', project_name: '', description: '' });
        setSelectedTeam(null);
        setSelectedUserIds([]);
        setAddMemberError(null);
    };

    /**
     * Handle team creation.
     */
    const handleCreate = async () => {
        try {
            await teamService.createTeam(formData);
            globalMessage.success(t('common.createSuccess'));
            closeModals();
            loadTeams();
        } catch (error: any) {
            const message = error?.response?.data?.error || error?.message || t('common.error');
            globalMessage.error(message);
            console.error('Failed to create team:', error);
        }
    };

    /**
     * Handle team update.
     */
    const handleUpdate = async () => {
        if (!selectedTeam) return;
        try {
            await teamService.updateTeam(selectedTeam.id, formData);
            globalMessage.success(t('common.updateSuccess'));
            closeModals();
            loadTeams();
        } catch (error: any) {
            const message = error?.response?.data?.error || error?.message || t('common.error');
            globalMessage.error(message);
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
            loadTeams(); // Refresh team cards to update member count and leader
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

    const uniqueProjects = Array.from(new Set(teams.map(t => t.project_name).filter(Boolean))) as string[];

    const filteredTeams = teams.filter(team => {
        const matchesSearch = team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            team.project_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProject = projectFilter === 'ALL' || team.project_name === projectFilter;
        return matchesSearch && matchesProject;
    });

    const availableUsers = users.filter(user =>
        (user.role === 'user' || user.role === 'leader') &&
        !members.some(member => member.id === user.id)
    );

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
                    onClick={async () => {
                        const confirmed = await confirm({ message: t('common.confirmDelete'), variant: 'danger' });
                        if (confirmed && selectedTeam) {
                            await teamService.removeMember(selectedTeam.id, record.id);
                            globalMessage.success(t('iam.teams.removeMemberSuccess'));
                            loadMembers(selectedTeam.id);
                            loadTeams(); // Refresh team cards to update member count and leader
                        }
                    }}
                >
                    {t('common.delete')}
                </Button>
            ),
        },
    ];

    return (
        <div className="h-full flex flex-col p-6 max-w-7xl mx-auto">
            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 shrink-0">
                <Input
                    size="large"
                    prefix={<Search className="text-slate-400" size={20} />}
                    placeholder={t('common.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="flex-1 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />

                <Select
                    size="large"
                    value={projectFilter}
                    onChange={handleProjectFilter}
                    className="sm:w-64"
                    options={[
                        { value: 'ALL', label: t('common.allProjects') || 'All Projects' },
                        ...uniqueProjects.map(project => ({ value: project, label: project }))
                    ]}
                />
            </div>

            {loading ? (
                <div className="flex-1 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                        {filteredTeams.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(team => (
                            <Card
                                key={team.id}
                                className="dark:bg-slate-800 dark:border-slate-700 shadow-sm"
                                actions={[
                                    <button
                                        key="members"
                                        onClick={() => openMembersModal(team)}
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
                                                    onClick={() => openEditModal(team)}
                                                />
                                            </Tooltip>
                                            <Tooltip title={t('common.delete')}>
                                                <Button
                                                    type="text"
                                                    danger
                                                    icon={<Trash2 size={18} />}
                                                    onClick={() => handleDelete(team.id)}
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
                        ))}
                    </div>
                </div>
            )}

            {/* Pagination for Teams */}
            {!loading && (
                <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700">
                    <Pagination
                        current={currentPage}
                        total={filteredTeams.length}
                        pageSize={pageSize}
                        showSizeChanger={true}
                        showTotal={(total: number) => t('common.totalItems', { total })}
                        pageSizeOptions={['10', '20', '30', '50', '100']}
                        onChange={(page: number, size: number) => {
                            setCurrentPage(page);
                            setPageSize(size);
                        }}
                    />
                </div>
            )}

            {/* Header Actions Portal */}
            {document.getElementById('header-actions') && createPortal(
                <Button
                    type="primary"
                    icon={<Plus size={20} />}
                    onClick={() => {
                        setFormData({ name: '', project_name: '', description: '' });
                        setIsCreateModalOpen(true);
                    }}
                    className="flex items-center gap-2"
                >
                    {t('iam.teams.create')}
                </Button>,
                document.getElementById('header-actions')!
            )}

            {/* Create/Edit Team Dialog */}
            <Dialog
                open={isCreateModalOpen || isEditModalOpen}
                onClose={closeModals}
                title={isCreateModalOpen ? t('iam.teams.create') : t('iam.teams.edit')}
                maxWidth="xl"
                footer={
                    <Space>
                        <Button onClick={closeModals}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="primary"
                            onClick={() => {
                                isCreateModalOpen ? handleCreate() : handleUpdate();
                            }}
                        >
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
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
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
                            onChange={e => setFormData({ ...formData, project_name: e.target.value })}
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
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                            placeholder={t('iam.teams.formDescription')}
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
            >
                <div className="h-full flex flex-col min-h-[400px]">
                    <div className="mb-6 flex gap-2 items-start shrink-0">
                        <div className="flex-1">
                            <UserMultiSelect
                                users={availableUsers}
                                selectedUserIds={selectedUserIds}
                                onChange={setSelectedUserIds}
                                placeholder={t('iam.teams.selectUser')}
                            />
                        </div>
                        <Button
                            type="primary"
                            onClick={handleAddMember}
                            disabled={selectedUserIds.length === 0}
                            icon={<Plus size={18} />}
                            className="h-[42px] mt-1"
                        >
                            {t('common.add')}
                        </Button>
                    </div>

                    {addMemberError && (
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm shrink-0">
                            {addMemberError}
                        </div>
                    )}

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

            <GuidelineDialog
                open={showGuide}
                onClose={() => setShowGuide(false)}
                featureId="iam"
            />
        </div>
    );
}
