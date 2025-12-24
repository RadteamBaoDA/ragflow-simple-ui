import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getKnowledgeBaseConfig, updateSystemConfig, addSource, updateSource, deleteSource, KnowledgeBaseSource, AccessControl } from '../api/knowledgeBaseService';
import { MessageSquare, Search, Plus, Edit2, Trash2, Save, ExternalLink, Shield } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { SourcePermissionsModal, PermissionsSelector } from '@/features/documents/components/SourcePermissionsModal';
import { useConfirm } from '@/components/ConfirmDialog';

export default function KnowledgeBaseConfigPage() {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'chat' | 'search'>('chat');

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

    const handleSaveDefault = () => {
        const payload = activeTab === 'chat' ? { defaultChatSourceId: defaultSourceId } : { defaultSearchSourceId: defaultSourceId };
        updateConfigMutation.mutate(payload);
    };

    // --- Source CRUD State ---
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSource, setEditingSource] = useState<KnowledgeBaseSource | null>(null);
    const [formData, setFormData] = useState({ name: '', url: '' });

    // Permissions state for create/edit dialog
    const [isPublic, setIsPublic] = useState(true);
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

    const openCreateDialog = () => {
        setEditingSource(null);
        setFormData({ name: '', url: '' });
        // Reset permissions for new source
        setIsPublic(true); // Default to public? User wanted Private default. Let's make it private default if desired, but code usually defaults to public. 
        // User checklist said "Fix: Default Source Permission to Private".
        // In backend migration we set default to false. So frontend should default to false (Private).
        setIsPublic(false);
        setSelectedTeamIds([]);
        setSelectedUserIds([]);
        setIsDialogOpen(true);
    };

    const openEditDialog = (source: KnowledgeBaseSource) => {
        setEditingSource(source);
        setFormData({ name: source.name, url: source.url });

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

    const openPermDialog = (source: KnowledgeBaseSource) => {
        setPermSource(source);
        setIsPermModalOpen(true);
    };

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
        mutationFn: (data: { name: string, url: string, access_control: AccessControl }) => addSource(activeTab, data.name, data.url, data.access_control),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['knowledgeBaseConfig'] });
            setIsDialogOpen(false);
        },
        meta: { successMessage: t('knowledgeBaseConfig.addSuccess') }
    });

    const updateMutation = useMutation({
        mutationKey: ['update', 'source'],
        mutationFn: (data: { id: string, name: string, url: string, access_control?: AccessControl }) => updateSource(data.id, data.name, data.url, data.access_control),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['knowledgeBaseConfig'] });
            setIsDialogOpen(false);
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

    return (
        <div className="w-[90%] mx-auto h-full flex flex-col p-6 space-y-6">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 shrink-0">
                <button
                    className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    onClick={() => setActiveTab('chat')}
                >
                    <MessageSquare size={18} />
                    {t('knowledgeBaseConfig.tabs.chat')}
                </button>
                <button
                    className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'search' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    onClick={() => setActiveTab('search')}
                >
                    <Search size={18} />
                    {t('knowledgeBaseConfig.tabs.search')}
                </button>
            </div>

            {/* Default Configuration Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 shrink-0">
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                            {t('knowledgeBaseConfig.defaultUrlLabel', { type: activeTab === 'chat' ? 'Chat' : 'Search' })}
                        </label>
                        <select
                            value={defaultSourceId}
                            onChange={(e) => setDefaultSourceId(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                            disabled={!configQuery.data}
                        >
                            <option value="">{t('common.select') || 'Select a source'}</option>
                            {(activeTab === 'chat' ? configQuery.data?.chatSources : configQuery.data?.searchSources)
                                ?.filter((source: KnowledgeBaseSource) => source.access_control?.public)
                                .map((source: KnowledgeBaseSource) => (
                                    <option key={source.id} value={source.id}>
                                        {source.name}
                                    </option>
                                ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t('knowledgeBaseConfig.publicOnlyNote') || 'Only public sources can be set as system defaults.'}
                        </p>
                    </div>
                    <button
                        onClick={handleSaveDefault}
                        disabled={updateConfigMutation.isPending || !defaultSourceId}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover disabled:opacity-50"
                    >
                        <Save size={18} />
                        {t('common.save')}
                    </button>
                    {/* Helper link */}
                    {defaultSourceId && configQuery.data && (
                        (() => {
                            const list = activeTab === 'chat' ? configQuery.data.chatSources : configQuery.data.searchSources;
                            const current = list.find(s => s.id === defaultSourceId);
                            if (current?.url) {
                                return (
                                    <a href={current.url} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-primary border rounded-md hover:bg-gray-50 dark:hover:bg-slate-700">
                                        <ExternalLink size={20} />
                                    </a>
                                );
                            }
                            return null;
                        })()
                    )}
                </div>
            </div>

            {/* Sources Management Section */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col flex-1 min-h-0">
                <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-700">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('knowledgeBaseConfig.sourcesList')}</h2>
                    <button
                        onClick={openCreateDialog}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                    >
                        <Plus size={16} />
                        {t('knowledgeBaseConfig.addSource')}
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-700 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-300">{t('common.name')}</th>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-300">URL</th>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-300 w-32 whitespace-nowrap">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                            {configQuery.isLoading ? (
                                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">{t('common.loading')}</td></tr>
                            ) : !currentSources || currentSources.length === 0 ? (
                                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">{t('common.noData')}</td></tr>
                            ) : (
                                currentSources.map((source: KnowledgeBaseSource) => (
                                    <tr key={source.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{source.name}</td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-mono text-xs truncate max-w-md" title={source.url}>{source.url}</td>
                                        <td className="px-6 py-4 flex gap-2">
                                            <button onClick={() => openEditDialog(source)} className="p-1 text-blue-600 hover:bg-blue-50 rounded dark:hover:bg-blue-900/30" title={t('common.edit')}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => openPermDialog(source)} className="p-1 text-purple-600 hover:bg-purple-50 rounded dark:hover:bg-purple-900/30" title={t('common.permissions') || 'Permissions'}>
                                                <Shield size={16} />
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const confirmed = await confirm({
                                                        message: t('common.confirmDelete'),
                                                        variant: 'danger'
                                                    });
                                                    if (confirmed) {
                                                        deleteMutation.mutate(source.id);
                                                    }
                                                }}
                                                className="p-1 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/30"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Dialog (Now Large with Permissions) */}
            <Dialog
                open={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                title={editingSource ? t('knowledgeBaseConfig.editSource') : t('knowledgeBaseConfig.addSource')}
                maxWidth="none"
                className="w-[70vw] h-[75vh]"
            >
                <div className="h-full flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-4 shrink-0">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{t('common.name')}</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                placeholder="e.g., Marketing Knowledge Base"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">URL</label>
                            <input
                                type="text"
                                value={formData.url}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    <div className="border-t dark:border-gray-700 my-2"></div>

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
        </div>
    );
}
