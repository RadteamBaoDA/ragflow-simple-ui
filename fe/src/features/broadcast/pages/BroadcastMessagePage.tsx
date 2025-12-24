/**
 * @fileoverview Admin page for managing broadcast messages.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { broadcastMessageService } from '../api/broadcastMessageService';
import { BroadcastMessage } from '../types';
import { Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Dialog } from '@/components/Dialog';

const BroadcastMessagePage: React.FC = () => {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<BroadcastMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingMessage, setEditingMessage] = useState<Partial<BroadcastMessage> | null>(null);

    const fetchMessages = async () => {
        setIsLoading(true);
        try {
            const data = await broadcastMessageService.getAllMessages();
            setMessages(data);
        } catch (err) {
            console.error('Failed to fetch messages:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    const handleSave = async () => {
        if (!editingMessage?.message || !editingMessage?.starts_at || !editingMessage?.ends_at) {
            alert(t('common.fillRequiredFields'));
            return;
        }

        try {
            if (editingMessage.id) {
                await broadcastMessageService.updateMessage(editingMessage.id, editingMessage);
            } else {
                await broadcastMessageService.createMessage(editingMessage as any);
            }
            setIsDialogOpen(false);
            fetchMessages();
        } catch (err) {
            console.error('Failed to save message:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('common.confirmDelete'))) return;
        try {
            await broadcastMessageService.deleteMessage(id);
            fetchMessages();
        } catch (err) {
            console.error('Failed to delete message:', err);
        }
    };

    const renderHeaderActions = () => {
        const headerActions = document.getElementById('header-actions');
        if (!headerActions) return null;

        return createPortal(
            <button
                onClick={() => {
                    setEditingMessage({
                        message: '',
                        starts_at: new Date().toISOString().slice(0, 16),
                        ends_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
                        color: '#E75E40',
                        font_color: '#FFFFFF',
                        is_active: true,
                        is_dismissible: true,
                    });
                    setIsDialogOpen(true);
                }}
                className="btn btn-primary flex items-center gap-2"
            >
                <Plus className="w-4 h-4" />
                {t('common.add')}
            </button>,
            headerActions
        );
    };

    return (
        <div className="p-6">
            {renderHeaderActions()}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
                <table className="w-full divide-y divide-slate-200 dark:divide-slate-700 table-fixed">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="w-1/2 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.message')}</th>
                            <th className="w-1/4 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.period')}</th>
                            <th className="w-40 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.status')}</th>
                            <th className="w-32 px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-slate-500">{t('common.loading')}...</td>
                            </tr>
                        ) : messages.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-slate-500">{t('common.noData')}</td>
                            </tr>
                        ) : (
                            messages.map((msg) => (
                                <tr key={msg.id}>
                                    <td className="px-6 py-4 whitespace-normal break-all">
                                        <div className="flex items-start gap-2">
                                            <div
                                                className="w-4 h-4 rounded-full border border-slate-200 mt-1 shrink-0"
                                                style={{ backgroundColor: msg.color }}
                                            />
                                            <span className="text-sm text-slate-900 dark:text-white leading-relaxed">
                                                {msg.message}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        <div className="flex flex-col">
                                            <span>{msg.starts_at ? new Date(msg.starts_at).toLocaleString() : '-'}</span>
                                            <span>{msg.ends_at ? new Date(msg.ends_at).toLocaleString() : '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {msg.is_active ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                {t('common.active')}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                                <XCircle className="w-3 h-3 mr-1" />
                                                {t('common.inactive')}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => {
                                                setEditingMessage(msg);
                                                setIsDialogOpen(true);
                                            }}
                                            className="text-blue-600 hover:text-blue-900 mr-3"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(msg.id)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Dialog
                open={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                title={editingMessage?.id ? t('common.edit') : t('common.add')}
                maxWidth="none"
                className="w-[60vw]"
                footer={
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsDialogOpen(false)} className="btn btn-secondary">{t('common.cancel')}</button>
                        <button onClick={handleSave} className="btn btn-primary">{t('common.save')}</button>
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
                            <input
                                type="datetime-local"
                                className="w-full input"
                                value={editingMessage?.starts_at?.slice(0, 16) || ''}
                                onChange={(e) => setEditingMessage({ ...editingMessage, starts_at: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('common.endDate')}</label>
                            <input
                                type="datetime-local"
                                className="w-full input"
                                value={editingMessage?.ends_at?.slice(0, 16) || ''}
                                onChange={(e) => setEditingMessage({ ...editingMessage, ends_at: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('common.backgroundColor')}</label>
                            <input
                                type="color"
                                className="w-full h-10 p-1"
                                value={editingMessage?.color || '#E75E40'}
                                onChange={(e) => setEditingMessage({ ...editingMessage, color: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('common.fontColor')}</label>
                            <input
                                type="color"
                                className="w-full h-10 p-1"
                                value={editingMessage?.font_color || '#FFFFFF'}
                                onChange={(e) => setEditingMessage({ ...editingMessage, font_color: e.target.value })}
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
