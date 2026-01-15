/**
 * @fileoverview Chat Widget Embed Component.
 * 
 * Renders a floating chat widget iframe with message listeners for
 * chat window creation and toggle functionality.
 * 
 * @module components/ChatWidgetEmbed
 */

import { useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/app/contexts/SettingsContext';
import { useSharedUser } from '@/features/users';

/**
 * @description Props for ChatWidgetEmbed component
 */
interface ChatWidgetEmbedProps {
    /** URL of the chat widget iframe */
    widgetUrl: string;
}

/**
 * @description Chat widget embed component that renders a floating chat button
 * and handles postMessage events for chat window creation and toggling.
 * 
 * @param {ChatWidgetEmbedProps} props - Component properties.
 * @param {string} props.widgetUrl - URL for the chat widget iframe.
 * @returns {JSX.Element} The rendered chat widget iframe and dynamic chat window.
 */
export function ChatWidgetEmbed({ widgetUrl }: ChatWidgetEmbedProps) {
    const { i18n } = useTranslation();
    const { resolvedTheme } = useSettings();
    const { user } = useSharedUser();

    // Reference to track if chat window has been created
    const chatWindowRef = useRef<HTMLIFrameElement | null>(null);

    /**
     * Build the widget URL with locale, email, and theme params.
     * Uses useMemo to avoid recalculating on every render.
     */
    const widgetSrc = useMemo(() => {
        try {
            const url = new URL(widgetUrl);
            // Add locale param
            if (i18n.language) {
                url.searchParams.set('locale', i18n.language);
            }
            // Add email param
            if (user?.email) {
                url.searchParams.set('email', user.email);
            }
            // Add theme param
            if (resolvedTheme) {
                url.searchParams.set('theme', resolvedTheme);
            }
            return url.toString();
        } catch {
            // If URL parsing fails, return original URL
            return widgetUrl;
        }
    }, [widgetUrl, i18n.language, user?.email, resolvedTheme]);

    /**
     * Effect: Set up message event listener for chat window control.
     * Handles CREATE_CHAT_WINDOW, TOGGLE_CHAT, and SCROLL_PASSTHROUGH events.
     */
    useEffect(() => {
        /**
         * Message event handler for chat widget communication.
         * @param e - MessageEvent from postMessage
         */
        const handleMessage = (e: MessageEvent) => {
            // Validate origin - accept from widget URL origin
            try {
                const widgetOrigin = new URL(widgetUrl).origin;
                if (e.origin !== widgetOrigin) return;
            } catch {
                // If URL parsing fails, skip origin check for safety
                return;
            }

            // Handle CREATE_CHAT_WINDOW event
            if (e.data.type === 'CREATE_CHAT_WINDOW') {
                // Prevent duplicate chat window creation
                if (document.getElementById('chat-win')) return;

                // Create chat window iframe
                const iframe = document.createElement('iframe');
                iframe.id = 'chat-win';
                iframe.src = e.data.src;
                iframe.style.cssText = 'position:fixed;bottom:140px;right:24px;width:380px;height:500px;border:none;background:transparent;z-index:9998;display:none';
                iframe.frameBorder = '0';
                iframe.allow = 'microphone;camera';
                document.body.appendChild(iframe);

                // Store reference for cleanup
                chatWindowRef.current = iframe;
            }
            // Handle TOGGLE_CHAT event
            else if (e.data.type === 'TOGGLE_CHAT') {
                const chatWindow = document.getElementById('chat-win') as HTMLIFrameElement | null;
                if (chatWindow) {
                    chatWindow.style.display = e.data.isOpen ? 'block' : 'none';
                }
            }
            // Handle SCROLL_PASSTHROUGH event
            else if (e.data.type === 'SCROLL_PASSTHROUGH') {
                window.scrollBy(0, e.data.deltaY);
            }

            else if (e.data.type === 'RESIZE_IFRAME') {
                const chatWindow = document.getElementById('chat-win') as HTMLIFrameElement | null;
                if (!chatWindow) return;
                if (e.data.expanded) {
                    chatWindow.style.height = '80vh';
                    chatWindow.style.width = '80vw';
                } else {
                    chatWindow.style.height = '500px';
                    chatWindow.style.width = '380px';
                }
            }
        };

        // Add event listener
        window.addEventListener('message', handleMessage);

        // Cleanup: Remove event listener and chat window on unmount
        return () => {
            window.removeEventListener('message', handleMessage);

            // Remove chat window if it exists
            const chatWindow = document.getElementById('chat-win');
            if (chatWindow) {
                chatWindow.remove();
            }
        };
    }, [widgetUrl]);

    return (
        <iframe
            src={widgetSrc}
            style={{
                position: 'fixed',
                bottom: '3.5rem',
                right: '1.5rem',
                width: '100px',
                height: '100px',
                border: 'none',
                background: 'transparent',
                zIndex: 100
            }}
            frameBorder="0"
            allow="microphone;camera"
            title="Chat Widget"
        />
    );
}

export default ChatWidgetEmbed;

