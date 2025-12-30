/**
 * @fileoverview Admin page for managing broadcast messages.
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { broadcastMessageService } from '../api/broadcastMessageService';
import { BroadcastMessage } from '../types';
import { Plus, CheckCircle, Trash2, Edit2, XCircle } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Table, Tag, Button, Card, Space, Pagination, Tooltip, DatePicker, ColorPicker } from 'antd';
import dayjs from 'dayjs';

/**
 * @description Admin dashboard page for creating, editing, and deleting broadcast messages.
 * Uses React Query for data fetching and mutations.
 *
 * @returns {JSX.Element} The Broadcast Message management page.
 */
const BroadcastMessagePage: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingMessage, setEditingMessage] = useState<Partial<BroadcastMessage> | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Fetch Messages Query
    const { data: messages = [], isLoading } = useQuery({
        queryKey: ['broadcastMessages'],
        queryFn: broadcastMessageService.getAllMessages
    });

    // Save Mutation (Create or Update)
    const saveMutation = useMutation({
        mutationKey: ['save', 'broadcastMessage'],
        mutationFn: (msg: Partial<BroadcastMessage>) => {
            if (msg.id) {
                return broadcastMessageService.updateMessage(msg.id, msg);
            } else {
                return broadcastMessageService.createMessage(msg as any);
            }
        },
        onSuccess: () => {
            setIsDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['broadcastMessages'] });
        },
        meta: { successMessage: t('admin.broadcast.saveSuccess') }
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationKey: ['delete', 'broadcastMessage'],
        mutationFn: broadcastMessageService.deleteMessage,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['broadcastMessages'] });
        },
        meta: { successMessage: t('admin.broadcast.deleteSuccess') }
    });

    /**
     * @description Validation and submission handler for saving a message.
     */
    const handleSave = async () => {
        if (!editingMessage?.message || !editingMessage?.starts_at || !editingMessage?.ends_at) {
            alert(t('common.fillRequiredFields'));
            return;
        }
        saveMutation.mutate(editingMessage);
    };

    /**
     * @description Handler for deleting a message after confirmation.
     * @param {string} id - ID of message to delete.
     */
    const handleDelete = async (id: string) => {
        if (!confirm(t('common.confirmDelete'))) return;
        deleteMutation.mutate(id);
    };

    /**
     * @description Renders the "Add" button into the header portal.
     * @returns {React.ReactPortal | null} Portal content.
     */
    const renderHeaderActions = () => {
        const headerActions = document.getElementById('header-actions');
        if (!headerActions) return null;

        return createPortal(
            <Button
                type="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => {
                    setEditingMessage({
                        message: '',
                        starts_at: new Date().toISOString().slice(0, 16),
                        ends_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
                        color: '#4043e7ff',
                        font_color: '#FFFFFF',
                        is_active: true,
                        is_dismissible: true,
                    });
                    setIsDialogOpen(true);
                }}
                className="flex items-center gap-2"
            >
                {t('common.add')}
            </Button>,
            headerActions
        );
    };

    const columns = [
        {
            title: t('common.message'),
            dataIndex: 'message',
            key: 'message',
            flex: 2,
            render: (text: string, record: BroadcastMessage) => (
                <div className="flex items-start gap-2 max-w-[500px]">
                    <div
                        className="w-4 h-4 rounded-full border border-slate-200 mt-1 shrink-0"
                        style={{ backgroundColor: record.color }}
                    />
                    <span className="text-sm text-slate-900 dark:text-white leading-relaxed break-all">
                        {text}
                    </span>
                </div>
            ),
        },
        {
            title: t('common.period'),
            key: 'period',
            width: 380,
            render: (_: any, record: BroadcastMessage) => (
                <div className="text-sm text-slate-500 whitespace-nowrap">
                    {record.starts_at ? new Date(record.starts_at).toLocaleString() : '-'}
                    <span className="mx-2">-</span>
                    {record.ends_at ? new Date(record.ends_at).toLocaleString() : '-'}
                </div>
            ),
        },
        {
            title: t('common.status'),
            dataIndex: 'is_active',
            key: 'is_active',
            width: 150,
            render: (isActive: boolean) => (
                <div className="whitespace-nowrap">
                    {isActive ? (
                        <Tag color="success" icon={<CheckCircle className="w-3 h-3" />} className="inline-flex items-center gap-1 px-2 py-0.5">
                            {t('common.active')}
                        </Tag>
                    ) : (
                        <Tag color="default" icon={<XCircle className="w-3 h-3" />} className="inline-flex items-center gap-1 px-2 py-0.5">
                            {t('common.inactive')}
                        </Tag>
                    )}
                </div>
            ),
        },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 120,
            align: 'right' as const,
            render: (_: any, record: BroadcastMessage) => (
                <Space>
                    <Tooltip title={t('common.edit')}>
                        <Button
                            type="text"
                            icon={<Edit2 className="w-4 h-4 text-blue-600" />}
                            onClick={() => {
                                setEditingMessage(record);
                                setIsDialogOpen(true);
                            }}
                        />
                    </Tooltip>
                    <Tooltip title={t('common.delete')}>
                        <Button
                            type="text"
                            danger
                            icon={<Trash2 className="w-4 h-4" />}
                            onClick={() => handleDelete(record.id)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <div className="p-6 h-full flex flex-col">
            {renderHeaderActions()}
            <Card
                styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
                className="dark:bg-slate-800 dark:border-slate-700 flex-1 min-h-0 overflow-hidden"
            >
                <div className="flex-1 overflow-auto p-4">
                    <Table
                        columns={columns}
                        dataSource={(messages || []).slice((currentPage - 1) * pageSize, currentPage * pageSize)}
                        rowKey="id"
                        loading={isLoading}
                        pagination={false}
                        scroll={{ x: true }}
                    />
                </div>
                <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700">
                    <Pagination
                        current={currentPage}
                        total={(messages || []).length}
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

            <Dialog
                open={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                title={editingMessage?.id ? t('common.edit') : t('common.add')}
                maxWidth="none"
                className="w-[60vw]"
                footer={
                    <div className="flex justify-end gap-2">
                        <Button onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
                        <Button type="primary" onClick={handleSave}>{t('common.save')}</Button>
                    </div>
                }
            >
                <div className="space-y-4 py-2">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium">{t('common.message')}</label>
                            <span className={`text-xs ${((editingMessage?.message?.length || 0) > 1900) ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                                {editingMessage?.message?.length || 0} / 2000 {t('common.characters')}
                            </span>
                        </div>
                        <textarea
                            className="w-full input"
                            value={editingMessage?.message || ''}
                            onChange={(e) => setEditingMessage({ ...editingMessage, message: e.target.value })}
                            rows={4}
                            maxLength={2000}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('common.startDate')}</label>
                            <DatePicker
                                showTime
                                className="w-full"
                                value={editingMessage?.starts_at ? dayjs(editingMessage.starts_at) : null}
                                onChange={(date) => setEditingMessage({ ...editingMessage, starts_at: date?.toISOString() || '' })}
                                placeholder={t('common.selectDateTime')}
                                disabledDate={(current) => editingMessage?.ends_at ? current > dayjs(editingMessage.ends_at) : false}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('common.endDate')}</label>
                            <DatePicker
                                showTime
                                className="w-full"
                                value={editingMessage?.ends_at ? dayjs(editingMessage.ends_at) : null}
                                onChange={(date) => setEditingMessage({ ...editingMessage, ends_at: date?.toISOString() || '' })}
                                placeholder={t('common.selectDateTime')}
                                disabledDate={(current) => editingMessage?.starts_at ? current < dayjs(editingMessage.starts_at) : false}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('common.backgroundColor')}</label>
                            <ColorPicker
                                value={editingMessage?.color || '#4043e7ff'}
                                onChange={(color) => setEditingMessage({ ...editingMessage, color: color.toHexString() })}
                                showText
                                format="hex"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('common.fontColor')}</label>
                            <ColorPicker
                                value={editingMessage?.font_color || '#FFFFFF'}
                                onChange={(color) => setEditingMessage({ ...editingMessage, font_color: color.toHexString() })}
                                showText
                                format="hex"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={editingMessage?.is_active || false}
                                onChange={(e) => setEditingMessage({ ...editingMessage, is_active: e.target.checked })}
                            />
                            {t('common.active')}
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={editingMessage?.is_dismissible || false}
                                onChange={(e) => setEditingMessage({ ...editingMessage, is_dismissible: e.target.checked })}
                            />
                            {t('common.dismissible')}
                        </label>
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default BroadcastMessagePage;
