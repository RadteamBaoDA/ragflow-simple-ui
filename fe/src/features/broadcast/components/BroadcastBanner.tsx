/**
 * @fileoverview Component to display active broadcast messages.
 */

import React, { useEffect, useState } from 'react';
import { broadcastMessageService } from '../api/broadcastMessageService';
import { BroadcastMessage } from '../types';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth';

interface BroadcastBannerProps {
    className?: string;
    inline?: boolean;
}

const BroadcastBanner: React.FC<BroadcastBannerProps> = ({ className = '', inline = false }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [messages, setMessages] = useState<BroadcastMessage[]>([]);
    const [dismissedMessages, setDismissedMessages] = useState<Record<string, number>>({});

    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const activeMessages = await broadcastMessageService.getActiveMessages();
                setMessages(activeMessages);
            } catch (err) {
                console.error('Failed to fetch broadcast messages:', err);
            }
        };

        fetchMessages();

        // Load dismissed messages from localStorage (for guest/immediate feedback)
        const saved = localStorage.getItem('dismissed_broadcasts_v2');
        if (saved) {
            try {
                const data = JSON.parse(saved) as Record<string, number>;
                setDismissedMessages(data);
            } catch (e) {
                console.error('Failed to parse dismissed broadcasts', e);
            }
        }
    }, [user?.id]); // Re-fetch when user session changes

    const handleDismiss = async (id: string) => {
        // 1. Immediate UI update via local state
        const now = Date.now();
        const newDismissed = { ...dismissedMessages, [id]: now };
        setDismissedMessages(newDismissed);
        localStorage.setItem('dismissed_broadcasts_v2', JSON.stringify(newDismissed));

        // 2. Persistent update on backend if logged in
        if (user) {
            try {
                await broadcastMessageService.dismissMessage(id);
            } catch (err) {
                console.error('Failed to record broadcast dismissal on server', err);
            }
        }
    };

    const visibleMessages = messages.filter(m => !dismissedMessages[m.id]);

    if (visibleMessages.length === 0) return null;

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            {visibleMessages.map((msg) => (
                <div
                    key={msg.id}
                    className={`relative px-4 py-2 text-center text-sm font-medium ${inline ? 'rounded-lg mb-4' : ''}`}
                    style={{
                        backgroundColor: msg.color,
                        color: msg.font_color,
                    }}
                >
                    <div className="relative flex items-center justify-center min-w-0 px-20">
                        <span className="text-center break-all whitespace-normal leading-relaxed">
                            {msg.message}
                        </span>
                        {msg.is_dismissible && (
                            <button
                                onClick={() => handleDismiss(msg.id)}
                                className="absolute right-2 px-2 py-1 hover:bg-black/20 bg-black/5 rounded-md transition-all flex items-center gap-1.5"
                                title={t('common.hide')}
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wider">{t('common.hide')}</span>
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default BroadcastBanner;
