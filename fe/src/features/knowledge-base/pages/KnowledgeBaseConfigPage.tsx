import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getKnowledgeBaseConfig, updateSystemConfig, addSource, updateSource, deleteSource, KnowledgeBaseSource, AccessControl } from '../api/knowledgeBaseService';
import { Save, Plus, ExternalLink, Trash2, Search, MessageSquare, Edit2, Shield } from 'lucide-react';
import { Card, Table, Button, Space, Tabs, Tooltip, Pagination as AntPagination, message } from 'antd';
import { Dialog } from '@/components/Dialog';
import { SourcePermissionsModal, PermissionsSelector } from '../components/SourcePermissionsModal';
import { useConfirm } from '@/components/ConfirmDialog';
import { teamApi, type Team } from '@/features/teams';
import { userApi } from '@/features/users';
import { User as UserType } from '@/features/auth';
import { useFirstVisit, GuidelineDialog } from '@/features/guideline';

/**
 * @fileoverview Knowledge Base Configuration Page.
 * 
 * Allows administrators to:
 * - Configure separate Chat and Search knowledge base sources.
 * - Set default sources for the system.
 * - Manage access control permissions (Public/Private/Team/User) for each source.
 * - Add/Edit/Delete sources via CRUD operations.
 */
export default function KnowledgeBaseConfigPage() {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'chat' | 'search'>('chat');

    const { isFirstVisit } = useFirstVisit('kb-config');
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => {
        if (isFirstVisit) {
            setShowGuide(true);
        }
    }, [isFirstVisit]);

    // Config (Defaults) Query
    const configQuery = useQuery({
        queryKey: ['knowledgeBaseConfig'],
        queryFn: getKnowledgeBaseConfig,
    });

    // --- Default URL Mutation ---
    const updateConfigMutation = useMutation({
        mutationKey: ['update', 'systemConfig'],
        mutationFn: updateSystemConfig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['knowledgeBaseConfig'] });
        },
        meta: { successMessage: t('common.saveSuccess') }
    });

    const [defaultSourceId, setDefaultSourceId] = useState('');

    // Sync input with fetched config
    useEffect(() => {
        if (configQuery.data) {
            setDefaultSourceId(activeTab === 'chat' ? configQuery.data.defaultChatSourceId : configQuery.data.defaultSearchSourceId);
        }
    }, [configQuery.data, activeTab]);

    /**
     * Save the default source selection for the current tab (Chat/Search).
     */
    const handleSaveDefault = () => {
        const payload = activeTab === 'chat' ? { defaultChatSourceId: defaultSourceId } : { defaultSearchSourceId: defaultSourceId };
        updateConfigMutation.mutate(payload);
    };

    // --- Source CRUD State ---
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSource, setEditingSource] = useState<KnowledgeBaseSource | null>(null);
    const [formData, setFormData] = useState({ name: '', url: '', description: '', shareId: '', chatWidgetUrl: '' });

    /**
     * Extract shared_id parameter from a URL.
     * @param url - The URL string to parse.
     * @returns The shared_id value or empty string if not found.
     */
    const extractShareIdFromUrl = (url: string): string => {
        try {
            const urlObj = new URL(url);
            return urlObj.searchParams.get('shared_id') || '';
        } catch {
            return '';
        }
    };

    /**
     * Handle URL input change with auto-extraction of shared_id.
     * @param url - The new URL value.
     */
    const handleTabChange = (key: string) => {
        setActiveTab(key as any);
        setCurrentPage(1);
    };
    const handleUrlChange = (url: string) => {
        const shareId = extractShareIdFromUrl(url);
        setFormData(prev => ({ ...prev, url, shareId }));
    };

    // Permissions state for create/edit dialog
    const [isPublic, setIsPublic] = useState(true);
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

    // --- Teams and Users Data Fetching ---
    const [teams, setTeams] = useState<Team[]>([]);
    const [users, setUsers] = useState<UserType[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Fetch teams and users when the create/edit dialog is opened and access is private
    useEffect(() => {
        if (isDialogOpen && !isPublic && teams.length === 0 && users.length === 0) {
            const fetchData = async () => {
                setIsLoadingData(true);
                try {
                    // Parallel fetch of teams and users from their respective services
                    const [teamsList, usersList] = await Promise.all([
                        teamApi.getTeams(),
                        userApi.getUsers()
                    ]);
                    setTeams(teamsList);
                    setUsers(usersList);
                } catch (error) {
                    console.error('[KnowledgeBaseConfigPage] Failed to fetch teams/users:', error);
                } finally {
                    setIsLoadingData(false);
                }
            };
            fetchData();
        }
    }, [isDialogOpen, isPublic, teams.length, users.length]);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    /**
     * Open the dialog to create a new source.
     * Resets form data and permissions to defaults (Private).
     */
    const openCreateDialog = () => {
        setEditingSource(null);
        setFormData({ name: '', url: '', description: '', shareId: '', chatWidgetUrl: '' });
        // Reset permissions for new source
        setIsPublic(false); // Default to private as per user checklist
        setSelectedTeamIds([]);
        setSelectedUserIds([]);
        setIsDialogOpen(true);
    };

    /**
     * Open the dialog to edit an existing source.
     * Loads existing data and permissions.
     * @param source - The source to edit.
     */
    const openEditDialog = (source: KnowledgeBaseSource) => {
        setEditingSource(source);
        setFormData({ name: source.name, url: source.url, description: source.description || '', shareId: source.share_id || '', chatWidgetUrl: source.chat_widget_url || '' });


        // Load existing permissions
        const acl = source.access_control || { public: true, team_ids: [], user_ids: [] };
        setIsPublic(acl.public);
        setSelectedTeamIds(acl.team_ids || []);
        setSelectedUserIds(acl.user_ids || []);

        setIsDialogOpen(true);
    };

    // --- Permissions Modal (Key Icon) State ---
    // We still keep this for quick permission edits without opening full edit dialog
    const [isPermModalOpen, setIsPermModalOpen] = useState(false);
    const [permSource, setPermSource] = useState<KnowledgeBaseSource | null>(null);

    /**
     * Open the standalone permissions modal for a source.
     * @param source - The source to manage permissions for.
     */
    const openPermDialog = (source: KnowledgeBaseSource) => {
        setPermSource(source);
        setIsPermModalOpen(true);
    };

    /**
     * Save updated permissions from the standalone permissions modal.
     * @param id - Source ID.
     * @param accessControl - New access control settings.
     */
    const handleSavePermissions = (id: string, accessControl: AccessControl) => {
        const source = (activeTab === 'chat' ? configQuery.data?.chatSources : configQuery.data?.searchSources)?.find(s => s.id === id);
        if (source) {
            updateMutation.mutate({
                id: source.id,
                name: source.name,
                url: source.url,
                access_control: accessControl
            });
            setIsPermModalOpen(false);
        }
    };

    // --- Mutations ---
    const createMutation = useMutation({
        mutationKey: ['create', 'source'],
        mutationFn: (data: { name: string, url: string, description: string, shareId: string, chatWidgetUrl: string, access_control: AccessControl }) => addSource(activeTab, data.name, data.url, data.access_control, data.shareId, data.description, data.chatWidgetUrl),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['knowledgeBaseConfig'] });
            setIsDialogOpen(false);
        },
        onError: (error: any) => {
            // Display error message from backend (e.g., duplicate name)
            const msg = error?.response?.data?.error || error?.message || t('common.error');
            message.error(msg);
        },
        meta: { successMessage: t('knowledgeBaseConfig.addSuccess') }
    });

    const updateMutation = useMutation({
        mutationKey: ['update', 'source'],
        mutationFn: (data: { id: string, name: string, url: string, description?: string, shareId?: string, chatWidgetUrl?: string, access_control?: AccessControl }) => updateSource(data.id, data.name, data.url, data.access_control, data.shareId, data.description, data.chatWidgetUrl),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['knowledgeBaseConfig'] });
            setIsDialogOpen(false);
        },
        onError: (error: any) => {
            // Display error message from backend (e.g., duplicate name)
            const msg = error?.response?.data?.error || error?.message || t('common.error');
            message.error(msg);
        },
        meta: { successMessage: t('knowledgeBaseConfig.updateSuccess') }
    });

    const deleteMutation = useMutation({
        mutationKey: ['delete', 'source'],
        mutationFn: deleteSource,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['knowledgeBaseConfig'] });
        },
        meta: { successMessage: t('knowledgeBaseConfig.deleteSuccess') }
    });

    /**
     * Submit the Create/Edit form.
     * Constructs the payload including permissions and triggers appropriate mutation.
     */
    const handleSubmitSource = () => {
        if (!formData.name || !formData.url) return;

        const access_control: AccessControl = {
            public: isPublic,
            team_ids: isPublic ? [] : selectedTeamIds,
            user_ids: isPublic ? [] : selectedUserIds,
        };

        if (editingSource) {
            updateMutation.mutate({ id: editingSource.id, ...formData, access_control });
        } else {
            createMutation.mutate({ ...formData, access_control });
        }
    };

    const currentSources = activeTab === 'chat' ? configQuery.data?.chatSources : configQuery.data?.searchSources;

    const columns = [
        {
            title: t('common.name'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span className="font-medium text-gray-900 dark:text-gray-100">{text}</span>,
        },
        {
            title: 'URL',
            dataIndex: 'url',
            key: 'url',
            render: (text: string) => (
                <div className="text-gray-500 dark:text-gray-400 font-mono text-xs whitespace-normal break-all" title={text}>
                    {text}
                </div>
            ),
        },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 150,
            render: (_: any, record: KnowledgeBaseSource) => (
                <Space>
                    <Tooltip title={t('common.edit')}>
                        <Button
                            type="text"
                            icon={<Edit2 size={16} />}
                            onClick={() => openEditDialog(record)}
                            className="text-blue-600 hover:text-blue-700"
                        />
                    </Tooltip>
                    <Tooltip title={t('common.permissions') || 'Permissions'}>
                        <Button
                            type="text"
                            icon={<Shield size={16} />}
                            onClick={() => openPermDialog(record)}
                            className="text-purple-600 hover:text-purple-700"
                        />
                    </Tooltip>
                    <Button
                        type="text"
                        danger
                        icon={<Trash2 size={16} />}
                        onClick={async () => {
                            const confirmed = await confirm({
                                message: t('common.confirmDelete'),
                                variant: 'danger'
                            });
                            if (confirmed) {
                                deleteMutation.mutate(record.id);
                            }
                        }}
                    />
                </Space>
            ),
        },
    ];

    return (
        <div className="w-full h-full flex flex-col p-8 overflow-hidden">
            <div className="w-[90%] mx-auto h-full flex flex-col space-y-6 min-h-0">
                {/* Tabs */}
                <Tabs
                    activeKey={activeTab}
                    onChange={handleTabChange}
                    items={[
                        {
                            key: 'chat',
                            label: (
                                <span className="flex items-center gap-2">
                                    <MessageSquare size={18} />
                                    {t('knowledgeBaseConfig.tabs.chat')}
                                </span>
                            ),
                        },
                        {
                            key: 'search',
                            label: (
                                <span className="flex items-center gap-2">
                                    <Search size={18} />
                                    {t('knowledgeBaseConfig.tabs.search')}
                                </span>
                            ),
                        },
                    ]}
                    className="mb-6 shrink-0"
                />

                {/* Default Configuration Section */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 shrink-0">
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        {t('knowledgeBaseConfig.defaultUrlLabel', { type: activeTab === 'chat' ? 'Chat' : 'Search' })}
                    </label>
                    <div className="flex gap-4 items-center">
                        <select
                            value={defaultSourceId}
                            onChange={(e) => setDefaultSourceId(e.target.value)}
                            className="flex-1 px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                            disabled={!configQuery.data}
                        >
                            <option value="">{t('common.select') || 'Select a source'}</option>
                            {(currentSources || []) // Ensure currentSources is an array for filter and map
                                .filter((source: KnowledgeBaseSource) => source.access_control?.public)
                                .map((source: KnowledgeBaseSource) => (
                                    <option key={source.id} value={source.id}>
                                        {source.name}
                                    </option>
                                ))}
                        </select>
                        <button
                            onClick={handleSaveDefault}
                            disabled={updateConfigMutation.isPending || !defaultSourceId}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover disabled:opacity-50 shrink-0"
                        >
                            <Save size={18} />
                            {t('common.save')}
                        </button>
                        {/* Helper link */}
                        {defaultSourceId && configQuery.data && (
                            (() => {
                                const list = activeTab === 'chat' ? configQuery.data.chatSources : configQuery.data.searchSources;
                                const current = list?.find(s => s.id === defaultSourceId); // Add null check for list
                                if (current?.url) {
                                    return (
                                        <a href={current.url} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-primary border rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 shrink-0">
                                            <ExternalLink size={20} />
                                        </a>
                                    );
                                }
                                return null;
                            })()
                        )}
                    </div>
                    <p className="mt-2 text-xs text-orange-500 dark:text-orange-400">
                        {t('knowledgeBaseConfig.publicOnlyNote') || 'Only public sources can be set as system defaults.'}
                    </p>
                </div>

                {/* Sources Management Section */}
                <Card
                    title={t('knowledgeBaseConfig.sourcesList')}
                    extra={
                        <Button
                            type="primary"
                            icon={<Plus size={16} />}
                            onClick={openCreateDialog}
                        >
                            {t('knowledgeBaseConfig.addSource')}
                        </Button>
                    }
                    styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' } }}
                    className="dark:bg-slate-800 dark:border-slate-700 flex flex-col flex-1 min-h-0 overflow-hidden"
                >
                    <div className="flex-1 overflow-hidden">
                        <Table
                            columns={columns}
                            dataSource={(currentSources || []).slice((currentPage - 1) * pageSize, currentPage * pageSize)} // Ensure currentSources is an array
                            rowKey="id"
                            loading={configQuery.isLoading}
                            pagination={false}
                            scroll={{ y: 'calc(100vh - 600px)' }}
                        />
                    </div>
                    <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700">
                        <AntPagination
                            current={currentPage}
                            total={currentSources?.length || 0}
                            pageSize={pageSize}
                            showSizeChanger={true}
                            showTotal={(total: number) => t('common.totalItems', { total })}
                            pageSizeOptions={['10', '20', '50', '100']}
                            onChange={(page: number, size: number) => {
                                setCurrentPage(page);
                                setPageSize(size);
                            }}
                        />
                    </div>
                </Card>

                {/* Add/Edit Dialog (Now Large with Permissions) */}
                <Dialog
                    open={isDialogOpen}
                    onClose={() => setIsDialogOpen(false)}
                    title={editingSource ? t('knowledgeBaseConfig.editSource') : t('knowledgeBaseConfig.addSource')}
                    maxWidth="none"
                    className="w-[70vw] h-[85vh]"
                >
                    <div className="h-full flex flex-col gap-6">
                        {/* Form Fields - Row 1: Name & URL */}
                        <div className="grid grid-cols-3 gap-4 shrink-0">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('common.name')}</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                    placeholder="e.g., Marketing KB"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">URL</label>
                                <input
                                    type="text"
                                    value={formData.url}
                                    onChange={(e) => handleUrlChange(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        {/* Form Fields - Row 2: Share ID & Description */}
                        <div className="grid grid-cols-3 gap-4 shrink-0">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('knowledgeBaseConfig.shareId') || 'Share ID'}</label>
                                <input
                                    type="text"
                                    value={formData.shareId}
                                    onChange={(e) => setFormData({ ...formData, shareId: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-white bg-gray-50 dark:bg-slate-700"
                                    placeholder={t('knowledgeBaseConfig.shareIdPlaceholder') || 'Auto-extracted'}
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('knowledgeBaseConfig.shareIdDesc') || 'Auto-extracted from URL'}</p>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('common.description') || 'Description'}</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                    placeholder={t('knowledgeBaseConfig.descriptionPlaceholder') || 'Optional description for this source'}
                                />
                            </div>
                        </div>

                        {/* Form Fields - Row 3: Chat Widget URL (Search tab only) */}
                        {activeTab === 'search' && (
                            <div className="shrink-0">
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('knowledgeBaseConfig.chatWidgetUrl') || 'Chat Widget URL'}</label>
                                <input
                                    type="text"
                                    value={formData.chatWidgetUrl}
                                    onChange={(e) => setFormData({ ...formData, chatWidgetUrl: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                    placeholder={t('knowledgeBaseConfig.chatWidgetUrlPlaceholder') || 'https://your-chat-widget-url.com'}
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('knowledgeBaseConfig.chatWidgetUrlDesc') || 'Optional URL for embedding a floating chat widget on the Search page'}</p>
                            </div>
                        )}

                        <div className="border-t dark:border-gray-700 my-2"></div>

                        <div className="flex-1 min-h-0">
                            <PermissionsSelector
                                isPublic={isPublic}
                                setIsPublic={setIsPublic}
                                selectedTeamIds={selectedTeamIds}
                                setSelectedTeamIds={setSelectedTeamIds}
                                selectedUserIds={selectedUserIds}
                                setSelectedUserIds={setSelectedUserIds}
                                teams={teams}
                                users={users}
                                isLoading={isLoadingData}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700 shrink-0 mt-auto">
                            <button
                                onClick={() => setIsDialogOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md dark:text-gray-300 dark:hover:bg-slate-700"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleSubmitSource}
                                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                            >
                                {t('common.save')}
                            </button>
                        </div>
                    </div>
                </Dialog>

                <SourcePermissionsModal
                    open={isPermModalOpen}
                    onClose={() => setIsPermModalOpen(false)}
                    source={permSource}
                    onSave={handleSavePermissions}
                />
                <GuidelineDialog
                    open={showGuide}
                    onClose={() => setShowGuide(false)}
                    featureId="kb-config"
                />
            </div>
        </div>
    );
}
