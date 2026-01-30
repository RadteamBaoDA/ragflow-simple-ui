/**
 * @fileoverview Prompts Management Page
 * 
 * Features:
 * - List prompts with search and tag filtering
 * - Create/Edit prompts via modal
 * - Display feedback counts (likes/dislikes) per prompt
 * - View detailed feedback list with date filtering
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, ThumbsUp, ThumbsDown, MessageCircle, Calendar, Search, Shield, Tag as TagIcon, Settings, Upload } from 'lucide-react';
import { Table, Card, Input, Button, Tag, Space, Select, Modal, Form, DatePicker, Pagination, Tooltip } from 'antd';
import { promptService } from '../api/promptService';
import { Prompt } from '../types/prompt';
import { TagInput } from '../components/TagInput';
import { PromptPermissionModal } from '../components/PromptPermissionModal';
import { PromptTagManagementModal } from '../components/PromptTagManagementModal';
import { BulkImportModal } from '../components/BulkImportModal';
import { globalMessage } from '@/app/App';
import { useAuth } from '@/features/auth';
import { useDebounce } from '@/hooks/useDebounce';
import { useFirstVisit, GuidelineDialog } from '@/features/guideline';
import dayjs from 'dayjs';

// ============================================================================
// Types
// ============================================================================

enum PermissionLevel {
    NONE = 0,
    VIEW = 1,
    UPLOAD = 2,
    FULL = 3
}

interface FeedbackCounts {
    like_count: number;
    dislike_count: number;
}

interface FeedbackDetail {
    id: string;
    prompt_id: string;
    user_id?: string;
    user_email?: string;
    interaction_type: 'like' | 'dislike' | 'comment';
    comment?: string;
    prompt_snapshot?: string;
    created_at: string;
}

// ============================================================================
// Component
// ============================================================================

export const PromptsPage = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [loading, setLoading] = useState(false);
    const [tags, setTags] = useState<{ name: string, color: string }[]>([]);
    const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>(PermissionLevel.NONE);

    // Feedback counts cache: promptId -> counts
    const [feedbackCountsMap, setFeedbackCountsMap] = useState<Record<string, FeedbackCounts>>({});

    const { isFirstVisit } = useFirstVisit('kb-prompts');
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => {
        if (isFirstVisit) {
            setShowGuide(true);
        }
    }, [isFirstVisit]);

    // Filters
    const [searchFilter, setSearchFilter] = useState<string | undefined>();
    const debouncedSearchFilter = useDebounce(searchFilter, 1000);
    const [tagFilter, setTagFilter] = useState<string[]>([]);

    // Create/Edit Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [isTagManagementOpen, setIsTagManagementOpen] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    // Feedback Details Modal State
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [selectedPromptForFeedback, setSelectedPromptForFeedback] = useState<Prompt | null>(null);
    const [feedbackDetails, setFeedbackDetails] = useState<FeedbackDetail[]>([]);
    const [loadingFeedback, setLoadingFeedback] = useState(false);
    const [feedbackDateRange, setFeedbackDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
    const [feedbackUserFilter, setFeedbackUserFilter] = useState<string | undefined>();

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // ========================================================================
    // Data Fetching
    // ========================================================================

    useEffect(() => {
        fetchPermission();
        fetchPrompts();
        fetchTags();
    }, [debouncedSearchFilter, tagFilter]);

    const fetchPermission = async () => {
        try {
            const { level } = await promptService.getMyPermission();
            setPermissionLevel(level);
        } catch (error) {
            console.error('Failed to fetch permission level:', error);
            setPermissionLevel(PermissionLevel.NONE);
        }
    };

    /**
     * Fetch prompts (feedback counts are now included in the response).
     */
    const fetchPrompts = async () => {
        setLoading(true);
        try {
            const filters: any = {};
            if (debouncedSearchFilter) filters.search = debouncedSearchFilter;
            if (searchFilter) filters.search = searchFilter;
            if (tagFilter && tagFilter.length > 0) filters.tags = tagFilter.join(',');

            const result = await promptService.getPrompts(filters);
            setPrompts(result.data);

            // Build feedbackCountsMap from the response data (counts are included)
            const countsMap: Record<string, FeedbackCounts> = {};
            result.data.forEach((prompt) => {
                countsMap[prompt.id] = {
                    like_count: prompt.like_count ?? 0,
                    dislike_count: prompt.dislike_count ?? 0
                };
            });
            setFeedbackCountsMap(countsMap);
        } catch (error) {
            console.error(error);
            globalMessage.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const fetchTags = async () => {
        try {
            // Fetch tags from prompt_tags table
            const tagsData = await promptService.getNewestTags(100);
            setTags(tagsData.map(t => ({ name: t.name, color: t.color })));
        } catch (error) {
            console.error(error);
        }
    };

    /**
     * Fetch feedback details for a specific prompt.
     */
    const fetchFeedbackDetails = async (promptId: string, startDate?: string, endDate?: string) => {
        setLoadingFeedback(true);
        try {
            const data = await promptService.getInteractions(promptId, startDate, endDate);
            setFeedbackDetails(data);
        } catch (error) {
            console.error(error);
            globalMessage.error(t('common.error'));
        } finally {
            setLoadingFeedback(false);
        }
    };

    const getTagColor = (tagName: string) => {
        const tag = tags.find(t => t.name === tagName);
        return tag ? tag.color : undefined;
    };

    // ========================================================================
    // Handlers
    // ========================================================================

    const handleSearch = (value: string) => {
        setSearchFilter(value || undefined);
        setCurrentPage(1);
    };

    const handleTagChange = (value: string[]) => {
        setTagFilter(value);
        setCurrentPage(1);
    };

    const handleDelete = (id: string) => {
        Modal.confirm({
            title: t('common.confirmDelete'),
            onOk: async () => {
                try {
                    await promptService.deletePrompt(id);
                    globalMessage.success(t('common.deleteSuccess'));
                    fetchPrompts();
                } catch (error) {
                    globalMessage.error(t('common.error'));
                }
            }
        });
    };

    // Create/Edit Modal Handlers
    const showModal = (prompt?: Prompt) => {
        setEditingPrompt(prompt || null);
        if (prompt) {
            form.setFieldsValue({
                prompt: prompt.prompt,
                description: prompt.description,
                tags: prompt.tags,
                source: prompt.source,
                is_active: prompt.is_active
            });
        } else {
            form.resetFields();
            form.setFieldsValue({
                source: 'chat',
                is_active: true,
                tags: []
            });
        }
        setIsModalOpen(true);
    };

    const handleCancel = () => {
        setIsModalOpen(false);
        setEditingPrompt(null);
        form.resetFields();
    };

    const handleFinish = async (values: any) => {
        setSubmitting(true);
        try {
            if (editingPrompt) {
                await promptService.updatePrompt(editingPrompt.id, values);
            } else {
                await promptService.createPrompt(values);
            }
            globalMessage.success(t('prompts.form.success'));
            setIsModalOpen(false);
            fetchPrompts();
            fetchTags();
        } catch (error: any) {
            // Display error message from backend (e.g., duplicate name)
            const message = error?.response?.data?.error || error?.message || t('common.error');
            globalMessage.error(message);
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    // Feedback Modal Handlers
    const openFeedbackModal = (prompt: Prompt) => {
        setSelectedPromptForFeedback(prompt);
        setFeedbackDateRange(null);
        fetchFeedbackDetails(prompt.id);
        setIsFeedbackModalOpen(true);
    };

    const closeFeedbackModal = () => {
        setIsFeedbackModalOpen(false);
        setSelectedPromptForFeedback(null);
        setFeedbackDetails([]);
        setFeedbackDateRange(null);
        setFeedbackUserFilter(undefined);
    };

    const handleFeedbackDateChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
        setFeedbackDateRange(dates);
        if (selectedPromptForFeedback) {
            const startDate = dates?.[0]?.startOf('day').toISOString();
            const endDate = dates?.[1]?.endOf('day').toISOString();
            fetchFeedbackDetails(selectedPromptForFeedback.id, startDate, endDate);
        }
    };

    // ========================================================================
    // Table Columns
    // ========================================================================

    const columns = [
        {
            title: t('prompts.fields.prompt'),
            dataIndex: 'prompt',
            key: 'prompt',
            width: '40%',
            render: (text: string) => (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {text}
                </div>
            )
        },
        {
            title: t('prompts.fields.description'),
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            width: '20%'
        },
        {
            title: t('prompts.fields.tags'),
            dataIndex: 'tags',
            key: 'tags',
            render: (tagNames: string[]) => (
                <div className="flex flex-wrap gap-y-2 gap-x-1">
                    {(tagNames || []).map(tagName => {
                        const color = getTagColor(tagName);
                        return (
                            <Tag
                                key={tagName}
                                className="border-none px-2 py-1 inline-flex items-center gap-1.5 rounded-md m-0"
                                style={color ? { backgroundColor: color, color: '#fff' } : {}}
                            >
                                <span className="font-medium">{tagName}</span>
                                <TagIcon size={12} className="text-white opacity-90" />
                            </Tag>
                        );
                    })}
                </div>
            )
        },
        {
            title: t('prompts.fields.feedback'),
            key: 'feedback',
            width: 150,
            render: (_: any, record: Prompt) => {
                const counts = feedbackCountsMap[record.id] || { like_count: 0, dislike_count: 0 };
                return (
                    <Button
                        type="link"
                        onClick={() => openFeedbackModal(record)}
                        className="flex items-center gap-2 p-0"
                    >
                        <span className="flex items-center gap-1 text-green-600">
                            <ThumbsUp size={14} />
                            {counts.like_count}
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">/</span>
                        <span className="flex items-center gap-1 text-red-500">
                            <ThumbsDown size={14} />
                            {counts.dislike_count}
                        </span>
                    </Button>
                );
            }
        },
        {
            title: t('prompts.fields.actions'),
            key: 'actions',
            width: 120,
            render: (_: any, record: Prompt) => (
                <Space>
                    <Tooltip title={permissionLevel < PermissionLevel.UPLOAD ? t('common.noPermission') : ''}>
                        <Button
                            type="text"
                            icon={<Edit2 size={16} />}
                            onClick={() => showModal(record)}
                            disabled={permissionLevel < PermissionLevel.UPLOAD}
                        />
                    </Tooltip>
                    <Tooltip title={permissionLevel < PermissionLevel.FULL ? t('common.noPermission') : ''}>
                        <Button
                            type="text"
                            danger
                            icon={<Trash2 size={16} />}
                            onClick={() => handleDelete(record.id)}
                            disabled={permissionLevel < PermissionLevel.FULL}
                        />
                    </Tooltip>
                </Space>
            )
        }
    ];

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Header with Search, Filter, and Add Button */}
            <div className="flex items-center gap-4">
                <Input
                    placeholder={t('prompts.searchPlaceholder')}
                    allowClear
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                    className="flex-1"
                    size="large"
                    prefix={<Search size={18} className="text-slate-400" />}
                />
                <Select
                    placeholder={t('prompts.filter.tag')}
                    style={{ minWidth: 200, maxWidth: 400 }}
                    allowClear
                    mode="multiple"
                    maxTagCount="responsive"
                    value={tagFilter}
                    onChange={handleTagChange}
                    size="large"
                    options={[
                        ...tags.map(tag => ({
                            label: (
                                <div className="flex items-center">
                                    <Tag
                                        className="border-none px-2 py-0.5 inline-flex items-center gap-1.5 rounded-md m-0"
                                        style={tag.color ? { backgroundColor: tag.color, color: '#fff' } : {}}
                                    >
                                        <span className="font-medium">{tag.name}</span>
                                        <TagIcon size={12} className="text-white opacity-90" />
                                    </Tag>
                                </div>
                            ),
                            value: tag.name
                        }))
                    ]}
                />

                <Space>
                    {user?.role === 'admin' && (
                        <>
                            <Button
                                type="default"
                                icon={<Settings size={16} />}
                                onClick={() => setIsTagManagementOpen(true)}
                                size="large"
                            >
                                {t('tags.manageButton', 'Manage Tags')}
                            </Button>
                            <Button
                                type="default"
                                icon={<Shield size={16} />}
                                onClick={() => setIsPermissionModalOpen(true)}
                                size="large"
                            >
                                {t('prompts.permissions.manage')}
                            </Button>
                        </>
                    )}
                    <Tooltip title={permissionLevel < PermissionLevel.UPLOAD ? t('common.noPermission') : ''}>
                        <Button
                            type="default"
                            icon={<Upload size={16} />}
                            onClick={() => setIsBulkImportOpen(true)}
                            size="large"
                            disabled={permissionLevel < PermissionLevel.UPLOAD}
                        >
                            {t('prompts.bulkImport.button', 'Import CSV')}
                        </Button>
                    </Tooltip>
                    <Tooltip title={permissionLevel < PermissionLevel.UPLOAD ? t('common.noPermission') : ''}>
                        <Button
                            type="primary"
                            icon={<Plus size={16} />}
                            onClick={() => showModal()}
                            size="large"
                            disabled={permissionLevel < PermissionLevel.UPLOAD}
                        >
                            {t('prompts.addNew')}
                        </Button>
                    </Tooltip>
                </Space>
            </div>

            {/* Table */}
            <Card
                styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
                className="dark:bg-slate-800 dark:border-slate-700 flex-1 min-h-0 overflow-hidden"
            >
                <div className="flex-1 overflow-auto p-4">
                    <Table
                        columns={columns}
                        dataSource={prompts.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
                        rowKey="id"
                        loading={loading}
                        pagination={false}
                        scroll={{ x: true }}
                    />
                </div>
                <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700">
                    <Pagination
                        current={currentPage}
                        total={prompts.length}
                        pageSize={pageSize}
                        showSizeChanger={true}
                        pageSizeOptions={['10', '20', '50', '100']}
                        onChange={(page: number, size: number) => {
                            setCurrentPage(page);
                            setPageSize(size);
                        }}
                    />
                </div>
            </Card>

            {/* Create/Edit Modal */}
            <Modal
                title={editingPrompt ? t('prompts.form.editTitle') : t('prompts.form.createTitle')}
                open={isModalOpen}
                onCancel={handleCancel}
                footer={null}
                width={800}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFinish}
                >
                    <Form.Item
                        name="prompt"
                        label={t('prompts.fields.prompt')}
                        rules={[{ required: true, message: t('prompts.form.promptRequired') }]}
                    >
                        <Input.TextArea rows={6} placeholder={t('prompts.form.promptPlaceholder')} />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label={t('prompts.fields.description')}
                    >
                        <Input placeholder={t('prompts.form.descriptionPlaceholder')} />
                    </Form.Item>

                    <Form.Item
                        name="tags"
                        label={t('prompts.fields.tags')}
                    >
                        <TagInput placeholder={t('prompts.form.searchTags')} />
                    </Form.Item>

                    <div className="flex justify-end gap-2">
                        <Button onClick={handleCancel}>
                            {t('common.cancel')}
                        </Button>
                        <Button type="primary" htmlType="submit" loading={submitting}>
                            {t('prompts.form.save')}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* Feedback Details Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <MessageCircle size={20} />
                        <span>{t('prompts.feedback.title')}</span>
                    </div>
                }
                open={isFeedbackModalOpen}
                onCancel={closeFeedbackModal}
                footer={null}
                width="50%"
            >
                {selectedPromptForFeedback && (
                    <div className="space-y-4">
                        {/* Prompt Preview */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                {selectedPromptForFeedback.prompt}
                            </p>
                        </div>

                        {/* Filters Row */}
                        <div className="flex items-center gap-3">
                            {/* Date Filter */}
                            <div className="flex items-center gap-2 flex-1">
                                <Calendar size={16} className="text-slate-500" />
                                <DatePicker.RangePicker
                                    value={feedbackDateRange}
                                    onChange={handleFeedbackDateChange}
                                    className="flex-1"
                                    allowClear
                                />
                            </div>
                            {/* User Filter */}
                            <Select
                                placeholder={t('prompts.feedback.filterByUser', 'Filter by user')}
                                value={feedbackUserFilter}
                                onChange={setFeedbackUserFilter}
                                allowClear
                                style={{ minWidth: 200 }}
                                options={[
                                    ...Array.from(new Set(feedbackDetails.map(fb => fb.user_email).filter(Boolean)))
                                        .map(email => ({ label: email, value: email }))
                                ]}
                            />
                        </div>

                        {/* Feedback List */}
                        <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                            {loadingFeedback ? (
                                <div className="text-center py-8 text-slate-500">{t('common.loading')}</div>
                            ) : feedbackDetails.filter(fb => !feedbackUserFilter || fb.user_email === feedbackUserFilter).length === 0 ? (
                                <div className="text-center py-8 text-slate-500">{t('common.noData')}</div>
                            ) : (
                                feedbackDetails.filter(fb => !feedbackUserFilter || fb.user_email === feedbackUserFilter).map((fb) => (
                                    <div
                                        key={fb.id}
                                        className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-3"
                                    >
                                        {/* Icon */}
                                        <div className={`p-2 rounded-full ${fb.interaction_type === 'like'
                                            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                            : fb.interaction_type === 'dislike'
                                                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                                : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                            }`}>
                                            {fb.interaction_type === 'like' && <ThumbsUp size={16} />}
                                            {fb.interaction_type === 'dislike' && <ThumbsDown size={16} />}
                                            {fb.interaction_type === 'comment' && <MessageCircle size={16} />}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                                    {fb.user_email || 'Anonymous'}
                                                </span>
                                                <span className="text-xs text-slate-400 flex-shrink-0">
                                                    {new Date(fb.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            {fb.comment && (
                                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                    {fb.comment}
                                                </p>
                                            )}
                                            {fb.prompt_snapshot && (
                                                <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    <span className="font-semibold">{t('prompts.feedback.promptSnapshot', 'Prompt at time of feedback')}:</span>
                                                    <p className="mt-1 whitespace-pre-wrap">{fb.prompt_snapshot}</p>
                                                </div>
                                            )}
                                            <Tag className="mt-1" color={
                                                fb.interaction_type === 'like' ? 'green'
                                                    : fb.interaction_type === 'dislike' ? 'red'
                                                        : 'blue'
                                            }>
                                                {fb.interaction_type.charAt(0).toUpperCase() + fb.interaction_type.slice(1)}
                                            </Tag>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            <PromptPermissionModal
                open={isPermissionModalOpen}
                onClose={() => setIsPermissionModalOpen(false)}
            />
            {user?.role === 'admin' && (
                <PromptTagManagementModal
                    open={isTagManagementOpen}
                    onClose={() => {
                        setIsTagManagementOpen(false);
                        fetchTags(); // Refresh tags after closing management modal
                    }}
                />
            )}
            <GuidelineDialog
                open={showGuide}
                onClose={() => setShowGuide(false)}
                featureId="kb-prompts"
            />
            <BulkImportModal
                open={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                onSuccess={() => {
                    fetchPrompts();
                    fetchTags();
                }}
            />
        </div>
    );
};

export default PromptsPage;
