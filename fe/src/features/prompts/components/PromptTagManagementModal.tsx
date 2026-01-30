
import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Input, List, Button, ColorPicker, message, Popconfirm, Spin, Empty, Tag } from 'antd';
import type { Color } from 'antd/es/color-picker';
import { Search, Plus, Edit2, Trash2, Tag as TagIcon, Save, X } from 'lucide-react';
import { promptService } from '../api/promptService';
import { PromptTag } from '../types/prompt';
import { useDebounce } from '@/hooks/useDebounce';

interface PromptTagManagementModalProps {
    open: boolean;
    onClose: () => void;
}

/**
 * Modal component for managing prompt tags (CRUD operations).
 * Admin-only feature.
 */
export const PromptTagManagementModal = ({ open, onClose }: PromptTagManagementModalProps) => {
    const { t } = useTranslation();

    // List state
    const [tags, setTags] = useState<PromptTag[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Edit state
    const [editingTag, setEditingTag] = useState<PromptTag | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('#1890ff');
    const [saving, setSaving] = useState(false);

    // Create state
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#1890ff');

    /**
     * Fetch tags from the API.
     */
    const fetchTags = useCallback(async () => {
        setLoading(true);
        try {
            const result = await promptService.searchTags(debouncedSearch, 100);
            setTags(result);
        } catch (error) {
            console.error('Failed to fetch tags:', error);
            message.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, t]);

    // Fetch tags when modal opens or search changes
    useEffect(() => {
        if (open) {
            fetchTags();
        }
    }, [open, fetchTags]);

    // Reset state when modal closes
    useEffect(() => {
        if (!open) {
            setEditingTag(null);
            setIsCreating(false);
            setSearchQuery('');
        }
    }, [open]);

    /**
     * Handle creating a new tag.
     */
    const handleCreate = async () => {
        if (!newName.trim()) {
            message.warning(t('prompts.tags.nameRequired', 'Tag name is required'));
            return;
        }
        setSaving(true);
        try {
            await promptService.createTag(newName.trim(), newColor);
            message.success(t('common.createSuccess'));
            setIsCreating(false);
            setNewName('');
            setNewColor('#1890ff');
            fetchTags();
        } catch (error: any) {
            console.error('Failed to create tag:', error);
            if (error.response?.status === 409) {
                message.error(t('prompts.tags.duplicateName', 'Tag name already exists'));
            } else {
                message.error(t('common.error'));
            }
        } finally {
            setSaving(false);
        }
    };

    /**
     * Handle updating an existing tag.
     */
    const handleUpdate = async () => {
        if (!editingTag) return;
        if (!editName.trim()) {
            message.warning(t('prompts.tags.nameRequired', 'Tag name is required'));
            return;
        }
        setSaving(true);
        try {
            await promptService.updateTag(editingTag.id, editName.trim(), editColor);
            message.success(t('common.updateSuccess'));
            setEditingTag(null);
            fetchTags();
        } catch (error: any) {
            console.error('Failed to update tag:', error);
            if (error.response?.status === 409) {
                message.error(t('prompts.tags.duplicateName', 'Tag name already exists'));
            } else if (error.response?.status === 404) {
                message.error(t('prompts.tags.notFound', 'Tag not found'));
            } else {
                message.error(t('common.error'));
            }
        } finally {
            setSaving(false);
        }
    };

    /**
     * Handle deleting a tag.
     */
    const handleDelete = async (tag: PromptTag) => {
        try {
            await promptService.deleteTag(tag.id);
            message.success(t('common.deleteSuccess'));
            fetchTags();
        } catch (error: any) {
            console.error('Failed to delete tag:', error);
            if (error.response?.status === 409) {
                const errorData = error.response?.data;
                message.error(errorData?.message || t('prompts.tags.inUse', 'Cannot delete tag because it is in use'));
            } else if (error.response?.status === 404) {
                message.error(t('prompts.tags.notFound', 'Tag not found'));
            } else {
                message.error(t('common.error'));
            }
        }
    };

    /**
     * Start editing a tag.
     */
    const startEdit = (tag: PromptTag) => {
        setEditingTag(tag);
        setEditName(tag.name);
        setEditColor(tag.color);
        setIsCreating(false);
    };

    /**
     * Cancel editing.
     */
    const cancelEdit = () => {
        setEditingTag(null);
    };

    /**
     * Start creating a new tag.
     */
    const startCreate = () => {
        setIsCreating(true);
        setEditingTag(null);
        setNewName('');
        setNewColor('#1890ff');
    };

    /**
     * Cancel creating.
     */
    const cancelCreate = () => {
        setIsCreating(false);
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <TagIcon className="w-5 h-5 text-primary" />
                    <span>{t('prompts.tags.manageTitle', 'Manage Tags')}</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={600}
            className="top-20"
        >
            {/* Search and Create Button */}
            <div className="flex items-center gap-3 mb-4">
                <Input
                    placeholder={t('prompts.tags.searchPlaceholder', 'Search tags...')}
                    prefix={<Search className="w-4 h-4 text-slate-400" />}
                    value={searchQuery}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    allowClear
                    className="flex-1"
                />
                <Button
                    type="primary"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={startCreate}
                    disabled={isCreating}
                >
                    {t('prompts.tags.create', 'Create')}
                </Button>
            </div>

            {/* Create Form */}
            {isCreating && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mb-4 border border-dashed border-primary">
                    <div className="flex items-center gap-3 mb-3">
                        <Input
                            placeholder={t('prompts.tags.namePlaceholder', 'Tag name')}
                            value={newName}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                            className="flex-1"
                            autoFocus
                            onPressEnter={handleCreate}
                        />
                        <ColorPicker
                            value={newColor}
                            onChange={(color: Color) => setNewColor(color.toHexString())}
                            size="middle"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button size="small" onClick={cancelCreate} icon={<X className="w-3 h-3" />}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            size="small"
                            type="primary"
                            onClick={handleCreate}
                            loading={saving}
                            icon={<Save className="w-3 h-3" />}
                        >
                            {t('common.save')}
                        </Button>
                    </div>
                </div>
            )}

            {/* Tags List */}
            <Spin spinning={loading}>
                <List
                    dataSource={tags}
                    locale={{ emptyText: <Empty description={t('common.noData')} /> }}
                    style={{ maxHeight: 400, overflowY: 'auto' }}
                    renderItem={(tag: PromptTag) => {
                        const isEditing = editingTag?.id === tag.id;

                        return (
                            <List.Item className="!px-0 !py-2">
                                {isEditing ? (
                                    // Edit Mode
                                    <div className="flex items-center gap-3 w-full">
                                        <Input
                                            value={editName}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                                            className="flex-1"
                                            autoFocus
                                            onPressEnter={handleUpdate}
                                        />
                                        <ColorPicker
                                            value={editColor}
                                            onChange={(color: Color) => setEditColor(color.toHexString())}
                                            size="small"
                                        />
                                        <Button
                                            size="small"
                                            onClick={cancelEdit}
                                            icon={<X className="w-3 h-3" />}
                                        />
                                        <Button
                                            size="small"
                                            type="primary"
                                            onClick={handleUpdate}
                                            loading={saving}
                                            icon={<Save className="w-3 h-3" />}
                                        />
                                    </div>
                                ) : (
                                    // View Mode
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2">
                                            <Tag
                                                className="border-none px-3 py-1 flex items-center gap-1.5 rounded-md m-0"
                                                style={{ backgroundColor: tag.color, color: '#fff' }}
                                            >
                                                <span className="font-medium">{tag.name}</span>
                                                <TagIcon size={12} className="text-white opacity-90" />
                                            </Tag>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="text"
                                                size="small"
                                                onClick={() => startEdit(tag)}
                                                icon={<Edit2 className="w-4 h-4 text-slate-500" />}
                                            />
                                            <Popconfirm
                                                title={t('prompts.tags.deleteConfirm', 'Delete this tag?')}
                                                description={t('prompts.tags.deleteWarning', 'Tags in use cannot be deleted.')}
                                                onConfirm={() => handleDelete(tag)}
                                                okText={t('common.delete')}
                                                cancelText={t('common.cancel')}
                                                okButtonProps={{ danger: true }}
                                            >
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    danger
                                                    icon={<Trash2 className="w-4 h-4" />}
                                                />
                                            </Popconfirm>
                                        </div>
                                    </div>
                                )}
                            </List.Item>
                        );
                    }}
                />
            </Spin>
        </Modal>
    );
};
