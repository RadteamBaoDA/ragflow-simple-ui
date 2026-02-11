/**
 * @fileoverview Task Management tab component for the Glossary page.
 * Renders the task table with search, CRUD actions, multi-select bulk delete, and the task modal.
 * @module features/glossary/components/TaskManagementTab
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Edit2, Trash2, Search, Upload, BookOpen } from 'lucide-react'
import { Card, Input, Button, Space, Modal, Form, Switch, Table, Tooltip, Badge } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { GlossaryTask } from '../api/glossaryApi'
import { glossaryApi } from '../api/glossaryApi'
import type { UseGlossaryTasksReturn } from '../hooks/useGlossaryTasks'
import { globalMessage } from '@/app/App'

/**
 * Props for the TaskManagementTab component.
 * @description Receives the task hook return and admin flag from the parent.
 */
interface TaskManagementTabProps {
    /** All values and handlers from useGlossaryTasks. */
    taskHook: UseGlossaryTasksReturn
    /** Whether the current user has admin/leader privileges. */
    isAdmin: boolean
    /** Callback to open the bulk import modal. */
    onOpenBulkImport: () => void
}

/**
 * Task Management tab — table with search, CRUD actions, multi-select bulk delete, and a create/edit modal.
 * @param props - Component props.
 * @returns React element.
 */
export const TaskManagementTab: React.FC<TaskManagementTabProps> = ({
    taskHook,
    isAdmin,
    onOpenBulkImport,
}) => {
    const { t } = useTranslation()

    // Row selection state for bulk delete
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [bulkDeleting, setBulkDeleting] = useState(false)

    const {
        filteredTasks,
        loading,
        search,
        setSearch,
        isModalOpen,
        editingTask,
        submitting,
        form,
        openModal,
        closeModal,
        handleSubmit,
        handleDelete,
    } = taskHook

    // ========================================================================
    // Bulk Delete Handler
    // ========================================================================

    /**
     * Delete all selected tasks by looping individual API calls.
     * @description Shows a confirmation modal, then deletes each selected task sequentially.
     */
    const handleBulkDelete = () => {
        Modal.confirm({
            title: t('glossary.task.bulkDeleteTitle'),
            content: t('glossary.task.bulkDeleteMessage', { count: selectedRowKeys.length }),
            okText: t('common.delete'),
            okButtonProps: { danger: true },
            onOk: async () => {
                setBulkDeleting(true)
                try {
                    // Delete each selected task sequentially
                    for (const id of selectedRowKeys) {
                        await glossaryApi.deleteTask(id as string)
                    }
                    globalMessage.success(t('glossary.task.bulkDeleteSuccess', { count: selectedRowKeys.length }))
                    setSelectedRowKeys([])
                    taskHook.refresh()
                } catch (error: any) {
                    globalMessage.error(error?.message || t('common.error'))
                } finally {
                    setBulkDeleting(false)
                }
            },
        })
    }

    // ========================================================================
    // Table Columns & Row Selection
    // ========================================================================

    /** Row selection config for Ant Design Table — only enabled for admin users. */
    const rowSelection = isAdmin ? {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    } : undefined

    /** Column definitions for the task table. */
    const columns: ColumnsType<GlossaryTask> = [
        {
            title: t('glossary.task.name'),
            dataIndex: 'name',
            key: 'name',
            width: '25%',
            render: (name: string) => (
                <span className="flex items-center gap-2">
                    <BookOpen size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="font-medium">{name}</span>
                </span>
            ),
        },
        {
            title: t('glossary.task.description'),
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
        },
        {
            title: t('glossary.task.taskInstructionEn'),
            dataIndex: 'task_instruction_en',
            key: 'task_instruction_en',
            ellipsis: true,
        },
        {
            title: t('glossary.task.taskInstructionJa'),
            dataIndex: 'task_instruction_ja',
            key: 'task_instruction_ja',
            ellipsis: true,
        },
        {
            title: t('glossary.task.taskInstructionVi'),
            dataIndex: 'task_instruction_vi',
            key: 'task_instruction_vi',
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
        // Conditionally add actions column for admin users
        ...(isAdmin
            ? [{
                title: t('common.actions'),
                key: 'actions',
                width: 100,
                render: (_: unknown, record: GlossaryTask) => (
                    <Space>
                        <Button type="text" icon={<Edit2 size={14} />} onClick={() => openModal(record)} />
                        <Button type="text" danger icon={<Trash2 size={14} />} onClick={() => handleDelete(record)} />
                    </Space>
                ),
            }]
            : []),
    ]

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div className="flex flex-col gap-3 h-full">
            {/* Search & Actions toolbar */}
            <div className="flex items-center gap-2">
                <Input
                    placeholder={t('glossary.task.searchPlaceholder')}
                    allowClear
                    value={search}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    prefix={<Search size={16} className="text-slate-400" />}
                    className="max-w-md"
                />
                {/* Bulk delete button — visible when items are selected */}
                {isAdmin && selectedRowKeys.length > 0 && (
                    <Button
                        danger
                        icon={<Trash2 size={16} />}
                        loading={bulkDeleting}
                        onClick={handleBulkDelete}
                    >
                        {t('glossary.task.deleteSelected', { count: selectedRowKeys.length })}
                    </Button>
                )}
                {isAdmin && (
                    <Space>
                        <Tooltip title={t('glossary.bulkImport.button')}>
                            <Button
                                icon={<Upload size={16} />}
                                onClick={onOpenBulkImport}
                            />
                        </Tooltip>
                        <Button
                            type="primary"
                            icon={<Plus size={16} />}
                            onClick={() => openModal()}
                        >
                            {t('glossary.task.add')}
                        </Button>
                    </Space>
                )}
            </div>

            {/* Tasks Table */}
            <Card
                className="dark:bg-slate-800 dark:border-slate-700 flex-1 min-h-0 overflow-hidden"
                styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
            >
                <div className="flex-1 overflow-auto">
                    <Table
                        columns={columns}
                        dataSource={filteredTasks}
                        rowKey="id"
                        loading={loading}
                        rowSelection={rowSelection}
                        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total: number) => `${total} items` }}
                        scroll={{ x: true, y: 'calc(100vh - 320px)' }}
                        locale={{ emptyText: t('common.noData') }}
                    />
                </div>
            </Card>

            {/* Task Create/Edit Modal */}
            <Modal
                title={editingTask ? t('glossary.task.editTitle') : t('glossary.task.createTitle')}
                open={isModalOpen}
                onCancel={closeModal}
                footer={null}
                width={700}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
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

                    {/* Multi-language task instructions */}
                    <Form.Item
                        name="task_instruction_en"
                        label={t('glossary.task.taskInstructionEn')}
                        rules={[{ required: true, message: t('glossary.task.taskInstructionRequired') }]}
                        tooltip={t('glossary.task.taskInstructionTooltip')}
                    >
                        <Input.TextArea rows={2} placeholder={t('glossary.task.taskInstructionPlaceholderEn')} />
                    </Form.Item>

                    <Form.Item
                        name="task_instruction_ja"
                        label={t('glossary.task.taskInstructionJa')}
                    >
                        <Input.TextArea rows={2} placeholder={t('glossary.task.taskInstructionPlaceholderJa')} />
                    </Form.Item>

                    <Form.Item
                        name="task_instruction_vi"
                        label={t('glossary.task.taskInstructionVi')}
                    >
                        <Input.TextArea rows={2} placeholder={t('glossary.task.taskInstructionPlaceholderVi')} />
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
                        <Button onClick={closeModal}>{t('common.cancel')}</Button>
                        <Button type="primary" htmlType="submit" loading={submitting}>
                            {t('common.save')}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    )
}
