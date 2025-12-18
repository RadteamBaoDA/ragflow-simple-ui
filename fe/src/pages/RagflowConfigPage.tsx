import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRagflowConfig, updateSystemUrls, addSource, updateSource, deleteSource, RagflowSource } from '../services/ragflowConfigService';
import { MessageSquare, Search, Plus, Edit2, Trash2, Save, ExternalLink } from 'lucide-react';
import { Dialog } from '../components/Dialog';

export default function RagflowConfigPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'chat' | 'search'>('chat');

    // Config (Defaults) Query
    const configQuery = useQuery({
        queryKey: ['ragflowConfig'],
        queryFn: getRagflowConfig,
    });

    // --- Default URL Mutation ---
    const updateConfigMutation = useMutation({
        mutationFn: updateSystemUrls,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ragflowConfig'] });
        }
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
    const [editingSource, setEditingSource] = useState<RagflowSource | null>(null);
    const [formData, setFormData] = useState({ name: '', url: '' });

    const openCreateDialog = () => {
        setEditingSource(null);
        setFormData({ name: '', url: '' });
        setIsDialogOpen(true);
    };

    const openEditDialog = (source: RagflowSource) => {
        setEditingSource(source);
        setFormData({ name: source.name, url: source.url });
        setIsDialogOpen(true);
    };

    // --- Mutations ---
    const createMutation = useMutation({
        mutationFn: (data: { name: string, url: string }) => addSource(activeTab, data.name, data.url),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ragflowConfig'] });
            setIsDialogOpen(false);
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string, name: string, url: string }) => updateSource(data.id, data.name, data.url),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ragflowConfig'] });
            setIsDialogOpen(false);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteSource,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ragflowConfig'] });
        }
    });

    const handleSubmitSource = () => {
        if (!formData.name || !formData.url) return;

        if (editingSource) {
            updateMutation.mutate({ id: editingSource.id, ...formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const currentSources = activeTab === 'chat' ? configQuery.data?.chatSources : configQuery.data?.searchSources;

    return (
        <div className="w-[80%] mx-auto h-full flex flex-col p-6 space-y-6">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 shrink-0">
                <button
                    className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'chat' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    onClick={() => setActiveTab('chat')}
                >
                    <MessageSquare size={18} />
                    {t('ragflowConfig.tabs.chat')}
                </button>
                <button
                    className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'search' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    onClick={() => setActiveTab('search')}
                >
                    <Search size={18} />
                    {t('ragflowConfig.tabs.search')}
                </button>
            </div>

            {/* Default Configuration Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 shrink-0">
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                            {t('ragflowConfig.defaultUrlLabel', { type: activeTab === 'chat' ? 'Chat' : 'Search' })}
                        </label>
                        <select
                            value={defaultSourceId}
                            onChange={(e) => setDefaultSourceId(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                            disabled={!configQuery.data}
                        >
                            <option value="">{t('common.select') || 'Select a source'}</option>
                            {(activeTab === 'chat' ? configQuery.data?.chatSources : configQuery.data?.searchSources)?.map((source: RagflowSource) => (
                                <option key={source.id} value={source.id}>
                                    {source.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleSaveDefault}
                        disabled={updateConfigMutation.isPending || !defaultSourceId}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                        <Save size={18} />
                        {t('common.save')}
                    </button>
                    {/* Helper link to open the selected source URL if available */}
                    {defaultSourceId && configQuery.data && (
                        (() => {
                            const list = activeTab === 'chat' ? configQuery.data.chatSources : configQuery.data.searchSources;
                            const current = list.find(s => s.id === defaultSourceId);
                            if (current?.url) {
                                return (
                                    <a href={current.url} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-primary-600 border rounded-md hover:bg-gray-50 dark:hover:bg-slate-700">
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
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('ragflowConfig.sourcesList')}</h2>
                    <button
                        onClick={openCreateDialog}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium"
                    >
                        <Plus size={16} />
                        {t('ragflowConfig.addSource')}
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-700 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-300">{t('common.name')}</th>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-300">URL</th>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-300 w-24">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                            {configQuery.isLoading ? (
                                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">{t('common.loading')}</td></tr>
                            ) : !currentSources || currentSources.length === 0 ? (
                                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">{t('common.noData')}</td></tr>
                            ) : (
                                currentSources.map((source: RagflowSource) => (
                                    <tr key={source.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{source.name}</td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-mono text-xs truncate max-w-md" title={source.url}>{source.url}</td>
                                        <td className="px-6 py-4 flex gap-2">
                                            <button onClick={() => openEditDialog(source)} className="p-1 text-blue-600 hover:bg-blue-50 rounded dark:hover:bg-blue-900/30">
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(t('common.confirmDelete'))) {
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

            {/* Add/Edit Dialog */}
            <Dialog
                open={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                title={editingSource ? t('ragflowConfig.editSource') : t('ragflowConfig.addSource')}
            >
                <div className="space-y-4">
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
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={() => setIsDialogOpen(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md dark:text-gray-300 dark:hover:bg-slate-700"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleSubmitSource}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                        >
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
