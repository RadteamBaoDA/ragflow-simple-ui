/**
 * @fileoverview Component for previewing text-based files (code, logs, plain text).
 */

import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * @description Props for TextPreview component.
 */
interface TextPreviewProps {
    /** URL of the text file */
    url: string;
    /** File extension (for potential syntax highlighting future-proofing) */
    extension: string;
}

/**
 * @description Fetches and displays the content of a text-based file.
 * Handles loading states and errors during fetch.
 *
 * @param {TextPreviewProps} props - Component props.
 * @returns {JSX.Element} Text preview component.
 */
export const TextPreview: React.FC<TextPreviewProps> = ({ url }) => {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                setLoading(true);
                const response = await fetch(url);
                if (!response.ok) throw new Error('Failed to load content');
                const text = await response.text();
                setContent(text);
            } catch (err) {
                setError('Failed to load text content');
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [url]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-red-500">
                <AlertCircle className="w-12 h-12 mb-2" />
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="h-full w-full overflow-auto p-6 bg-white dark:bg-gray-900">
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">
                {content}
            </pre>
        </div>
    );
};
