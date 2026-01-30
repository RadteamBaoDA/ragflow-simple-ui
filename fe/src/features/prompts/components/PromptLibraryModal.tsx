
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Input, List, Tag, Button, Empty, Tooltip, message, Select, Popover } from 'antd';
import { Search, Copy, Book, Tag as TagIcon, ThumbsUp, ThumbsDown, Settings } from 'lucide-react';
import { promptService } from '../api/promptService';
import { Prompt } from '../types/prompt';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { PromptTagManagementModal } from './PromptTagManagementModal';

interface PromptLibraryModalProps {
    open: boolean;
    onClose: () => void;
    /** Optional callback when a prompt is selected - if provided, text will be passed to this instead of clipboard */
    onSelect?: (text: string) => void;
}

export const PromptLibraryModal = ({ open, onClose, onSelect }: PromptLibraryModalProps) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 1000);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [availableTags, setAvailableTags] = useState<{ name: string, color: string }[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const PAGE_SIZE = 25;

    // Tag management modal (admin only)
    const [isTagManagementOpen, setIsTagManagementOpen] = useState(false);

    // Reset and fetch when modal opens
    useEffect(() => {
        if (open) {
            setPrompts([]);
            setOffset(0);
            setTotal(0);
            fetchInitialData();
        }
    }, [open]);

    // Fetch when search or tags change (reset offset)
    useEffect(() => {
        if (open) {
            setPrompts([]);
            setOffset(0);
            fetchPrompts(0, true);
        }
    }, [debouncedSearchText, selectedTags]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [promptResult, tagsData] = await Promise.all([
                promptService.getPrompts({ limit: PAGE_SIZE, offset: 0 }),
                promptService.getNewestTags(50)
            ]);
            setPrompts(promptResult.data);
            setTotal(promptResult.total);
            setOffset(PAGE_SIZE);
            setAvailableTags(tagsData.map(t => ({ name: t.name, color: t.color })));
        } catch (error) {
            console.error('Failed to fetch prompt library data:', error);
            message.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const fetchPrompts = async (currentOffset: number, isReset = false) => {
        if (isReset) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }
        const params: any = { limit: PAGE_SIZE, offset: currentOffset };
        if (debouncedSearchText) params.search = debouncedSearchText;
        if (selectedTags.length > 0) params.tags = selectedTags.join(','); // Send all tags for AND filtering
        try {
            const result = await promptService.getPrompts(params);
            if (isReset) {
                setPrompts(result.data);
            } else {
                setPrompts(prev => [...prev, ...result.data]);
            }
            setTotal(result.total);
            setOffset(currentOffset + PAGE_SIZE);
        } catch (error) {
            console.error('Failed to fetch prompts:', error);
            message.error(t('common.error'));
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleCopy = (text: string) => {
        if (onSelect) {
            // If onSelect callback is provided, use it instead of clipboard
            onSelect(text);
            message.success(t('prompts.library.copied'));
        } else {
            // Fallback to clipboard copy
            navigator.clipboard.writeText(text);
            message.success(t('prompts.library.copied'));
        }
        onClose();
    };

    const getTagColor = (tagName: string) => {
        const tag = availableTags.find(t => t.name === tagName);
        return tag ? tag.color : undefined;
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        // Load more when near bottom and not already loading and more data available
        if (scrollHeight - scrollTop <= clientHeight + 100 && !loadingMore && prompts.length < total) {
            fetchPrompts(offset);
        }
    };

    return (
        <>
            <Modal
                title={
                    <div className="flex items-center justify-between w-full pr-8">
                        <div className="flex items-center gap-2">
                            <Book className="w-5 h-5 text-primary" />
                            <span>{t('prompts.library.title', 'Prompt Library')}</span>
                        </div>
                        {isAdmin && (
                            <Button
                                type="text"
                                icon={<Settings className="w-4 h-4" />}
                                onClick={() => setIsTagManagementOpen(true)}
                            >
                                {t('prompts.tags.manageButton', 'Manage Tags')}
                            </Button>
                        )}
                    </div>
                }
                open={open}
                onCancel={onClose}
                footer={null}
                width="70%"
                className="top-10"
                styles={{ body: { maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
            >
                {/* Search and Filter */}
                <div className="flex items-center gap-3 mb-4">
                    <Input
                        placeholder={t('prompts.library.searchPlaceholder', 'Search prompts...')}
                        prefix={<Search className="w-4 h-4 text-slate-400" />}
                        value={searchText}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
                        allowClear
                        size="large"
                        className="flex-1"
                    />
                    <Select
                        mode="multiple"
                        placeholder={t('prompts.filter.tag', 'Filter by tags')}
                        value={selectedTags}
                        onChange={setSelectedTags}
                        options={availableTags.map(tag => ({
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
                        }))}
                        className="w-1/3 min-w-[200px]"
                        style={{ minHeight: 44 }}
                        size="large"
                        allowClear
                        maxTagCount="responsive"
                    />
                </div>

                {/* Prompts List */}
                <div
                    className="flex-1 overflow-y-scroll pr-2 prompt-library-scroll"
                    style={{
                        maxHeight: 'calc(80vh - 140px)',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#64748b transparent'
                    }}
                    onScroll={handleScroll}
                >
                    <style>{`
                    .prompt-library-scroll::-webkit-scrollbar {
                        width: 8px;
                    }
                    .prompt-library-scroll::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .prompt-library-scroll::-webkit-scrollbar-thumb {
                        background-color: #64748b;
                        border-radius: 4px;
                    }
                    .prompt-library-scroll::-webkit-scrollbar-thumb:hover {
                        background-color: #475569;
                    }
                `}</style>
                    <List
                        loading={loading}
                        dataSource={prompts}
                        locale={{ emptyText: <Empty description={t('common.noData')} /> }}
                        renderItem={(item: Prompt) => (
                            <List.Item
                                className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 mb-3 p-4 hover:border-primary dark:hover:border-primary transition-colors cursor-pointer group"
                                onClick={() => handleCopy(item.prompt)}
                            >
                                <div className="w-full">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <div className="text-sm text-slate-900 dark:text-slate-100 font-medium whitespace-pre-wrap break-all font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-700">
                                                {item.prompt}
                                            </div>
                                        </div>
                                        <div className="flex items-center">
                                            <PromptInteractionButtons promptId={item.id} />
                                            <Tooltip title={t('common.copy')}>
                                                <Button
                                                    type="text"
                                                    icon={<Copy className="w-4 h-4" />}
                                                    className="ml-2 text-slate-400 hover:text-primary"
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleCopy(item.prompt); }}
                                                />
                                            </Tooltip>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-2">
                                        <div className="flex flex-wrap gap-y-2 gap-x-1">
                                            {item.tags?.map(tagName => {
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
                                        {item.description && (
                                            <Tooltip title={item.description} placement="left">
                                                <span className="text-xs text-slate-500 italic truncate max-w-[200px] cursor-help">
                                                    {item.description}
                                                </span>
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>
                            </List.Item>
                        )}
                    />
                    {/* Loading More Indicator */}
                    {loadingMore && (
                        <div className="flex items-center justify-center py-4 gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                            <span className="text-sm text-slate-500">{t('common.loading', 'Loading...')}</span>
                        </div>
                    )}
                </div>

                <div className="mt-4 text-xs text-center text-slate-400">
                    {t('prompts.library.clickToCopy', 'Click on a prompt to copy it to clipboard')}
                </div>
            </Modal>

            {/* Tag Management Modal - Admin Only */}
            {
                isAdmin && (
                    <PromptTagManagementModal
                        open={isTagManagementOpen}
                        onClose={() => {
                            setIsTagManagementOpen(false);
                            // Refresh tags after management
                            promptService.getNewestTags(50).then(tagsData => {
                                setAvailableTags(tagsData.map(t => ({ name: t.name, color: t.color })));
                            });
                        }}
                    />
                )
            }
        </>
    );
};

// Internal component for interaction buttons
const PromptInteractionButtons = ({ promptId }: { promptId: string }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [dislikeOpen, setDislikeOpen] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [interacted, setInteracted] = useState<'like' | 'dislike' | null>(null);

    // Import Icons here or use from parent scope? Better to import at top of file.
    // Assuming ThumbsUp, ThumbsDown, Popover are imported at top.

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (loading) return;
        setLoading(true);
        try {
            await promptService.addInteraction({ prompt_id: promptId, interaction_type: 'like' });
            setInteracted('like');
            message.success(t('prompts.library.feedbackSuccess'));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDislikeSubmit = async () => {
        if (loading) return;
        setLoading(true);
        try {
            await promptService.addInteraction({
                prompt_id: promptId,
                interaction_type: 'dislike',
                comment: feedback
            });
            setInteracted('dislike');
            setDislikeOpen(false);
            setFeedback('');
            message.success(t('prompts.library.feedbackSuccess'));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const content = (
        <div className="w-64" onClick={(e) => e.stopPropagation()}>
            <Input.TextArea
                value={feedback}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
                placeholder={t('prompts.library.feedbackPlaceholder')}
                maxLength={500}
                rows={3}
                className="mb-2"
            />
            <div className="flex justify-end gap-2">
                <Button size="small" onClick={() => setDislikeOpen(false)}>
                    {t('common.cancel')}
                </Button>
                <Button
                    size="small"
                    type="primary"
                    onClick={handleDislikeSubmit}
                    loading={loading}
                >
                    {t('prompts.library.submitFeedback')}
                </Button>
            </div>
        </div>
    );

    return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Tooltip title={t('prompts.feedback.like')}>
                <Button
                    type="text"
                    size="small"
                    icon={<ThumbsUp size={14} className={interacted === 'like' ? "fill-green-500 text-green-500" : "text-slate-400"} />}
                    onClick={handleLike}
                    className="hover:text-green-500 hover:bg-green-50"
                />
            </Tooltip>

            <Tooltip title={t('prompts.feedback.dislike')}>
                {/* Popover wrapper */}
                <Popover
                    content={content}
                    title={t('prompts.library.feedback')}
                    trigger="click"
                    open={dislikeOpen}
                    onOpenChange={(open: boolean) => {
                        // Only allow opening if not already interacted? Or allow re-feedback?
                        // Let's allow simple open/close.
                        // Prevent click propagation when clicking button to open popover
                        setDislikeOpen(open);
                    }}
                    placement="bottomRight"
                >
                    <Button
                        type="text"
                        size="small"
                        icon={<ThumbsDown size={14} className={interacted === 'dislike' ? "fill-red-500 text-red-500" : "text-slate-400"} />}
                        className="hover:text-red-500 hover:bg-red-50"
                    />
                </Popover>
            </Tooltip>
        </div>
    );
};
