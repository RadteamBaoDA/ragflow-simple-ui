/**
 * @fileoverview Glossary Management Page
 *
 * Split-panel layout:
 * - Left panel: Task list with search, create, edit, delete
 * - Right panel: Keywords for selected task with CRUD
 *
 * Uses Ant Design components and follows existing project patterns.
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Plus, Edit2, Trash2, Search, Upload, BookOpen, Tag, ChevronRight
} from 'lucide-react'
import {
    Card, Input, Button, Space, Modal, Form, Switch, Table, Empty, Tooltip, Badge
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
    glossaryApi,
    type GlossaryTask,
    type GlossaryKeyword,
    type GlossaryTaskWithKeywords,
    type CreateTaskDto,
    type CreateKeywordDto,
} from '../api/glossaryApi'
import { GlossaryBulkImportModal } from '../components/GlossaryBulkImportModal'
import { globalMessage } from '@/app/App'
import { useAuth } from '@/features/auth'

// ============================================================================
// Component
// ============================================================================

export const GlossaryPage = () => {
    const { t } = useTranslation()
    const { user } = useAuth()
    const isAdmin = user?.role === 'admin' || user?.role === 'leader'

    // Tasks state
    const [tasks, setTasks] = useState<GlossaryTask[]>([])
    const [loadingTasks, setLoadingTasks] = useState(false)
    const [searchTask, setSearchTask] = useState('')
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

    // Keywords state
    const [selectedTaskDetail, setSelectedTaskDetail] = useState<GlossaryTaskWithKeywords | null>(null)
    const [loadingKeywords, setLoadingKeywords] = useState(false)

    // Task modal state
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<GlossaryTask | null>(null)
    const [submittingTask, setSubmittingTask] = useState(false)
    const [taskForm] = Form.useForm()

    // Keyword modal state
    const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false)
    const [editingKeyword, setEditingKeyword] = useState<GlossaryKeyword | null>(null)
    const [submittingKeyword, setSubmittingKeyword] = useState(false)
    const [keywordForm] = Form.useForm()

    // Bulk import modal state
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)

    // ========================================================================
    // Data Fetching
    // ========================================================================

    const fetchTasks = useCallback(async () => {
        setLoadingTasks(true)
        try {
            const data = await glossaryApi.listTasks()
            setTasks(data)
        } catch (error) {
            console.error('Error fetching tasks:', error)
            globalMessage.error(t('common.error'))
        } finally {
            setLoadingTasks(false)
        }
    }, [t])

    const fetchTaskDetail = useCallback(async (taskId: string) => {
        setLoadingKeywords(true)
        try {
            const detail = await glossaryApi.getTask(taskId)
            setSelectedTaskDetail(detail)
        } catch (error) {
            console.error('Error fetching task detail:', error)
            globalMessage.error(t('common.error'))
        } finally {
            setLoadingKeywords(false)
        }
    }, [t])

    useEffect(() => {
        fetchTasks()
    }, [fetchTasks])

    useEffect(() => {
        if (selectedTaskId) {
            fetchTaskDetail(selectedTaskId)
        } else {
            setSelectedTaskDetail(null)
        }
    }, [selectedTaskId, fetchTaskDetail])

    // ========================================================================
    // Task Handlers
    // ========================================================================

    const filteredTasks = tasks.filter((task) =>
        task.name.toLowerCase().includes(searchTask.toLowerCase())
    )

    const openTaskModal = (task?: GlossaryTask) => {
        setEditingTask(task || null)
        if (task) {
            taskForm.setFieldsValue({
                name: task.name,
                description: task.description,
                task_instruction: task.task_instruction,
                context_template: task.context_template,
                sort_order: task.sort_order,
                is_active: task.is_active,
            })
        } else {
            taskForm.resetFields()
            taskForm.setFieldsValue({ is_active: true, sort_order: 0 })
        }
        setIsTaskModalOpen(true)
    }

    const handleTaskSubmit = async (values: CreateTaskDto & { sort_order?: number; is_active?: boolean }) => {
        setSubmittingTask(true)
        try {
            if (editingTask) {
                await glossaryApi.updateTask(editingTask.id, values)
                globalMessage.success(t('glossary.task.updateSuccess'))
            } else {
                await glossaryApi.createTask(values)
                globalMessage.success(t('glossary.task.createSuccess'))
            }
            setIsTaskModalOpen(false)
            fetchTasks()
            // Refresh detail if editing the currently selected task
            if (editingTask && selectedTaskId === editingTask.id) {
                fetchTaskDetail(editingTask.id)
            }
        } catch (error: any) {
            const msg = error?.response?.data?.error || error?.message || t('common.error')
            globalMessage.error(msg)
        } finally {
            setSubmittingTask(false)
        }
    }

    const handleDeleteTask = (task: GlossaryTask) => {
        Modal.confirm({
            title: t('glossary.task.confirmDelete'),
            content: t('glossary.task.confirmDeleteMessage', { name: task.name }),
            okText: t('common.delete'),
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await glossaryApi.deleteTask(task.id)
                    globalMessage.success(t('glossary.task.deleteSuccess'))
                    if (selectedTaskId === task.id) {
                        setSelectedTaskId(null)
                    }
                    fetchTasks()
                } catch (error: any) {
                    globalMessage.error(error?.message || t('common.error'))
                }
            },
        })
    }

    // ========================================================================
    // Keyword Handlers
    // ========================================================================

    const openKeywordModal = (keyword?: GlossaryKeyword) => {
        setEditingKeyword(keyword || null)
        if (keyword) {
            keywordForm.setFieldsValue({
                name: keyword.name,
                description: keyword.description,
                sort_order: keyword.sort_order,
                is_active: keyword.is_active,
            })
        } else {
            keywordForm.resetFields()
            keywordForm.setFieldsValue({ is_active: true, sort_order: 0 })
        }
        setIsKeywordModalOpen(true)
    }

    const handleKeywordSubmit = async (values: CreateKeywordDto & { sort_order?: number; is_active?: boolean }) => {
        if (!selectedTaskId) return
        setSubmittingKeyword(true)
        try {
            if (editingKeyword) {
                await glossaryApi.updateKeyword(editingKeyword.id, values)
                globalMessage.success(t('glossary.keyword.updateSuccess'))
            } else {
                await glossaryApi.createKeyword(selectedTaskId, values)
                globalMessage.success(t('glossary.keyword.createSuccess'))
            }
            setIsKeywordModalOpen(false)
            fetchTaskDetail(selectedTaskId)
        } catch (error: any) {
            const msg = error?.response?.data?.error || error?.message || t('common.error')
            globalMessage.error(msg)
        } finally {
            setSubmittingKeyword(false)
        }
    }

    const handleDeleteKeyword = (keyword: GlossaryKeyword) => {
        Modal.confirm({
            title: t('glossary.keyword.confirmDelete'),
            content: t('glossary.keyword.confirmDeleteMessage', { name: keyword.name }),
            okText: t('common.delete'),
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await glossaryApi.deleteKeyword(keyword.id)
                    globalMessage.success(t('glossary.keyword.deleteSuccess'))
                    if (selectedTaskId) fetchTaskDetail(selectedTaskId)
                } catch (error: any) {
                    globalMessage.error(error?.message || t('common.error'))
                }
            },
        })
    }

    // ========================================================================
    // Table Columns
    // ========================================================================

    const keywordColumns: ColumnsType<GlossaryKeyword> = [
        {
            title: t('glossary.keyword.name'),
            dataIndex: 'name',
            key: 'name',
            width: '30%',
        },
        {
            title: t('glossary.keyword.description'),
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
        },
        {
            title: t('glossary.keyword.status'),
            dataIndex: 'is_active',
            key: 'is_active',
            width: 100,
            render: (active: boolean) => (
                <Badge
                    status={active ? 'success' : 'default'}
                    text={active ? t('common.active') : t('common.inactive')}
                />
            ),
        },
        ...(isAdmin
            ? [{
                title: t('common.actions'),
                key: 'actions',
                width: 100,
                render: (_: unknown, record: GlossaryKeyword) => (
                    <Space>
                        <Button type="text" icon={<Edit2 size={14} />} onClick={() => openKeywordModal(record)} />
                        <Button type="text" danger icon={<Trash2 size={14} />} onClick={() => handleDeleteKeyword(record)} />
                    </Space>
                ),
            }]
            : []),
    ]

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div className="h-full flex gap-4">
            {/* Left Panel - Tasks List */}
            <div className="w-[360px] flex flex-col gap-3 flex-shrink-0">
                {/* Task Search & Actions */}
                <div className="flex items-center gap-2">
                    <Input
                        placeholder={t('glossary.task.searchPlaceholder')}
                        allowClear
                        value={searchTask}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTask(e.target.value)}
                        prefix={<Search size={16} className="text-slate-400" />}
                    />
                    {isAdmin && (
                        <Space>
                            <Tooltip title={t('glossary.bulkImport.button')}>
                                <Button
                                    icon={<Upload size={16} />}
                                    onClick={() => setIsBulkImportOpen(true)}
                                />
                            </Tooltip>
                            <Button
                                type="primary"
                                icon={<Plus size={16} />}
                                onClick={() => openTaskModal()}
                            >
                                {t('glossary.task.add')}
                            </Button>
                        </Space>
                    )}
                </div>

                {/* Tasks List */}
                <Card
                    className="dark:bg-slate-800 dark:border-slate-700 flex-1 min-h-0 overflow-hidden"
                    styles={{ body: { padding: 0, height: '100%', overflow: 'auto' } }}
                >
                    {filteredTasks.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={loadingTasks ? t('common.loading') : t('common.noData')}
                            />
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredTasks.map((task) => (
                                <div
                                    key={task.id}
                                    className={`px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedTaskId === task.id
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-l-3 border-l-blue-500'
                                            : ''
                                        }`}
                                    onClick={() => setSelectedTaskId(task.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <BookOpen size={16} className="text-slate-400 flex-shrink-0" />
                                            <span className="font-medium text-sm truncate">{task.name}</span>
                                            {!task.is_active && (
                                                <Badge status="default" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {isAdmin && (
                                                <>
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        icon={<Edit2 size={12} />}
                                                        onClick={(e: React.MouseEvent) => {
                                                            e.stopPropagation()
                                                            openTaskModal(task)
                                                        }}
                                                    />
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        danger
                                                        icon={<Trash2 size={12} />}
                                                        onClick={(e: React.MouseEvent) => {
                                                            e.stopPropagation()
                                                            handleDeleteTask(task)
                                                        }}
                                                    />
                                                </>
                                            )}
                                            <ChevronRight size={14} className="text-slate-300" />
                                        </div>
                                    </div>
                                    {task.description && (
                                        <p className="text-xs text-slate-500 mt-1 truncate pl-6">
                                            {task.description}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* Right Panel - Keywords for Selected Task */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
                {selectedTaskDetail ? (
                    <>
                        {/* Selected Task Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <Tag size={18} />
                                    {selectedTaskDetail.name}
                                </h3>
                                {selectedTaskDetail.description && (
                                    <p className="text-sm text-slate-500 mt-0.5">{selectedTaskDetail.description}</p>
                                )}
                            </div>
                            {isAdmin && (
                                <Button
                                    type="primary"
                                    icon={<Plus size={16} />}
                                    onClick={() => openKeywordModal()}
                                >
                                    {t('glossary.keyword.add')}
                                </Button>
                            )}
                        </div>

                        {/* Prompt Template Preview */}
                        <Card
                            size="small"
                            className="dark:bg-slate-800 dark:border-slate-700"
                        >
                            <div className="text-xs text-slate-500 mb-1">{t('glossary.task.promptPreview')}</div>
                            <pre className="text-sm whitespace-pre-wrap font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded">
                                {selectedTaskDetail.task_instruction}
                                {'\n'}
                                {selectedTaskDetail.context_template}
                            </pre>
                        </Card>

                        {/* Keywords Table */}
                        <Card
                            className="dark:bg-slate-800 dark:border-slate-700 flex-1 min-h-0 overflow-hidden"
                            styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
                        >
                            <div className="flex-1 overflow-auto p-4">
                                <Table
                                    columns={keywordColumns}
                                    dataSource={selectedTaskDetail.keywords}
                                    rowKey="id"
                                    loading={loadingKeywords}
                                    pagination={false}
                                    scroll={{ x: true }}
                                    locale={{ emptyText: t('glossary.keyword.empty') }}
                                />
                            </div>
                        </Card>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={t('glossary.task.selectPrompt')}
                        />
                    </div>
                )}
            </div>

            {/* ============================================================= */}
            {/* Task Modal */}
            {/* ============================================================= */}
            <Modal
                title={editingTask ? t('glossary.task.editTitle') : t('glossary.task.createTitle')}
                open={isTaskModalOpen}
                onCancel={() => setIsTaskModalOpen(false)}
                footer={null}
                width={600}
                destroyOnClose
            >
                <Form
                    form={taskForm}
                    layout="vertical"
                    onFinish={handleTaskSubmit}
                    preserve={false}
                >
                    <Form.Item
                        name="name"
                        label={t('glossary.task.name')}
                        rules={[{ required: true, message: t('glossary.task.nameRequired') }]}
                    >
                        <Input placeholder={t('glossary.task.namePlaceholder')} />
                    </Form.Item>

                    <Form.Item name="description" label={t('glossary.task.description')}>
                        <Input.TextArea rows={2} placeholder={t('glossary.task.descriptionPlaceholder')} />
                    </Form.Item>

                    <Form.Item
                        name="task_instruction"
                        label={t('glossary.task.taskInstruction')}
                        rules={[{ required: true, message: t('glossary.task.taskInstructionRequired') }]}
                        tooltip={t('glossary.task.taskInstructionTooltip')}
                    >
                        <Input.TextArea rows={3} placeholder={t('glossary.task.taskInstructionPlaceholder')} />
                    </Form.Item>

                    <Form.Item
                        name="context_template"
                        label={t('glossary.task.contextTemplate')}
                        rules={[{ required: true, message: t('glossary.task.contextTemplateRequired') }]}
                        tooltip={t('glossary.task.contextTemplateTooltip')}
                    >
                        <Input.TextArea rows={3} placeholder={t('glossary.task.contextTemplatePlaceholder')} />
                    </Form.Item>

                    <div className="flex gap-4">
                        <Form.Item name="sort_order" label={t('glossary.common.sortOrder')} className="w-32">
                            <Input type="number" min={0} />
                        </Form.Item>
                        <Form.Item name="is_active" label={t('glossary.common.active')} valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button onClick={() => setIsTaskModalOpen(false)}>{t('common.cancel')}</Button>
                        <Button type="primary" htmlType="submit" loading={submittingTask}>
                            {t('common.save')}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ============================================================= */}
            {/* Keyword Modal */}
            {/* ============================================================= */}
            <Modal
                title={editingKeyword ? t('glossary.keyword.editTitle') : t('glossary.keyword.createTitle')}
                open={isKeywordModalOpen}
                onCancel={() => setIsKeywordModalOpen(false)}
                footer={null}
                width={500}
                destroyOnClose
            >
                <Form
                    form={keywordForm}
                    layout="vertical"
                    onFinish={handleKeywordSubmit}
                    preserve={false}
                >
                    <Form.Item
                        name="name"
                        label={t('glossary.keyword.name')}
                        rules={[{ required: true, message: t('glossary.keyword.nameRequired') }]}
                    >
                        <Input placeholder={t('glossary.keyword.namePlaceholder')} />
                    </Form.Item>

                    <Form.Item name="description" label={t('glossary.keyword.description')}>
                        <Input.TextArea rows={2} placeholder={t('glossary.keyword.descriptionPlaceholder')} />
                    </Form.Item>

                    <div className="flex gap-4">
                        <Form.Item name="sort_order" label={t('glossary.common.sortOrder')} className="w-32">
                            <Input type="number" min={0} />
                        </Form.Item>
                        <Form.Item name="is_active" label={t('glossary.common.active')} valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button onClick={() => setIsKeywordModalOpen(false)}>{t('common.cancel')}</Button>
                        <Button type="primary" htmlType="submit" loading={submittingKeyword}>
                            {t('common.save')}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ============================================================= */}
            {/* Bulk Import Modal */}
            {/* ============================================================= */}
            <GlossaryBulkImportModal
                open={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                onSuccess={() => {
                    fetchTasks()
                    if (selectedTaskId) fetchTaskDetail(selectedTaskId)
                }}
            />
        </div>
    )
}

export default GlossaryPage
