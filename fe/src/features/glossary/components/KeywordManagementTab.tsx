/**
 * @fileoverview Keyword Management tab component for the Glossary page.
 * Renders the keyword table with search, CRUD actions, multi-select bulk delete, and the keyword modal.
 * @module features/glossary/components/KeywordManagementTab
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Edit2, Trash2, Search, Tag, Upload } from 'lucide-react'
import { Card, Input, Button, Space, Modal, Form, Switch, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { GlossaryKeyword } from '../api/glossaryApi'
import { glossaryApi } from '../api/glossaryApi'
import type { UseGlossaryKeywordsReturn } from '../hooks/useGlossaryKeywords'
import { KeywordBulkImportModal } from './KeywordBulkImportModal'
import { globalMessage } from '@/app/App'

/**
 * Props for the KeywordManagementTab component.
 * @description Receives the keyword hook return and admin flag from the parent.
 */
interface KeywordManagementTabProps {
    /** All values and handlers from useGlossaryKeywords. */
    keywordHook: UseGlossaryKeywordsReturn
    /** Whether the current user has admin/leader privileges. */
    isAdmin: boolean
}

/**
 * Keyword Management tab — table with search, CRUD actions, multi-select bulk delete, and a create/edit modal.
 * @param props - Component props.
 * @returns React element.
 */
export const KeywordManagementTab: React.FC<KeywordManagementTabProps> = ({
    keywordHook,
    isAdmin,
}) => {
    const { t } = useTranslation()
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)

    // Row selection state for bulk delete
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [bulkDeleting, setBulkDeleting] = useState(false)

    const {
        filteredKeywords,
        loading,
        search,
        setSearch,
        isModalOpen,
        editingKeyword,
        submitting,
        form,
        openModal,
        closeModal,
        handleSubmit,
        handleDelete,
    } = keywordHook

    // ========================================================================
    // Bulk Delete Handler
    // ========================================================================

    /**
     * Delete all selected keywords by looping individual API calls.
     * @description Shows a confirmation modal, then deletes each selected keyword sequentially.
     */
    const handleBulkDelete = () => {
        Modal.confirm({
            title: t('glossary.keyword.bulkDeleteTitle'),
            content: t('glossary.keyword.bulkDeleteMessage', { count: selectedRowKeys.length }),
            okText: t('common.delete'),
            okButtonProps: { danger: true },
            onOk: async () => {
                setBulkDeleting(true)
                try {
                    // Delete each selected keyword sequentially
                    for (const id of selectedRowKeys) {
                        await glossaryApi.deleteKeyword(id as string)
                    }
                    globalMessage.success(t('glossary.keyword.bulkDeleteSuccess', { count: selectedRowKeys.length }))
                    setSelectedRowKeys([])
                    keywordHook.refresh()
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

    /** Column definitions for the keyword table. */
    const columns: ColumnsType<GlossaryKeyword> = [
        {
            title: t('glossary.keyword.name'),
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => (
                <span className="flex items-center gap-2">
                    <Tag size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="font-medium">{name}</span>
                </span>
            ),
        },
        {
            title: t('glossary.keyword.enKeyword'),
            dataIndex: 'en_keyword',
            key: 'en_keyword',
            ellipsis: true,
        },
        {
            title: t('glossary.keyword.description'),
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
        },
        // Conditionally add actions column for admin users
        ...(isAdmin
            ? [{
                title: t('common.actions'),
                key: 'actions',
                width: 100,
                render: (_: unknown, record: GlossaryKeyword) => (
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
                    placeholder={t('glossary.keyword.searchPlaceholder')}
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
                        {t('glossary.keyword.deleteSelected', { count: selectedRowKeys.length })}
                    </Button>
                )}
                {isAdmin && (
                    <>
                        <Tooltip title={t('glossary.keywordImport.button')}>
                            <Button
                                icon={<Upload size={16} />}
                                onClick={() => setIsBulkImportOpen(true)}
                            />
                        </Tooltip>
                        <Button
                            type="primary"
                            icon={<Plus size={16} />}
                            onClick={() => openModal()}
                        >
                            {t('glossary.keyword.add')}
                        </Button>
                    </>
                )}
            </div>

            {/* Keywords Table */}
            <Card
                className="dark:bg-slate-800 dark:border-slate-700 flex-1 min-h-0 overflow-hidden"
                styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
            >
                <div className="flex-1 overflow-auto">
                    <Table
                        columns={columns}
                        dataSource={filteredKeywords}
                        rowKey="id"
                        loading={loading}
                        rowSelection={rowSelection}
                        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total: number) => `${total} items` }}
                        scroll={{ x: true, y: 'calc(100vh - 320px)' }}
                        locale={{ emptyText: t('glossary.keyword.empty') }}
                    />
                </div>
            </Card>

            {/* Keyword Create/Edit Modal */}
            <Modal
                title={editingKeyword ? t('glossary.keyword.editTitle') : t('glossary.keyword.createTitle')}
                open={isModalOpen}
                onCancel={closeModal}
                footer={null}
                width={500}
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
                        label={t('glossary.keyword.name')}
                        rules={[{ required: true, message: t('glossary.keyword.nameRequired') }]}
                    >
                        <Input placeholder={t('glossary.keyword.namePlaceholder')} />
                    </Form.Item>

                    <Form.Item name="en_keyword" label={t('glossary.keyword.enKeyword')}>
                        <Input placeholder={t('glossary.keyword.enKeywordPlaceholder')} />
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
                        <Button onClick={closeModal}>{t('common.cancel')}</Button>
                        <Button type="primary" htmlType="submit" loading={submitting}>
                            {t('common.save')}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* Keyword Bulk Import Modal */}
            <KeywordBulkImportModal
                open={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                onSuccess={() => {
                    keywordHook.refresh()
                    setIsBulkImportOpen(false)
                }}
            />
        </div>
    )
}
