/**
 * @fileoverview Markdown content renderer with syntax highlighting.
 * 
 * Uses react-markdown with remark-gfm for Github-flavored markdown,
 * rehype-highlight for code block syntax highlighting, and rehype-raw
 * to support custom HTML tags (like <mark> for highlighting).
 * 
 * Custom components are implemented for:
 * - Links (open in new tab)
 * - Tables (styled with horizontal overflow)
 * - Headings (with consistent sizing and spacing)
 * 
 * @module components/MarkdownRenderer
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github-dark.css'; // Import a highlight.js theme

/**
 * Props for the MarkdownRenderer component.
 */
interface MarkdownRendererProps {
    /** The raw markdown string to render */
    children: string;
    /** Additional CSS classes for the container */
    className?: string;
    /** Text to automatically wrap in <mark> tags for highlighting */
    highlightText?: string;
}

/**
 * Markdown Renderer Component.
 * 
 * Features:
 * - GFM (Tables, Checklists, etc.)
 * - Syntax highlighting for code blocks
 * - Support for HTML tags in markdown
 * - Custom text highlighting via regex
 * - Responsive table layouts
 * 
 * @param {MarkdownRendererProps} props - Component properties
 * @returns {JSX.Element} The rendered Markdown content
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ children, className, highlightText }) => {
    let content = children || '';
    if (highlightText && highlightText.trim()) {
        try {
            const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapeRegExp(highlightText)})`, 'gi');
            content = content.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-900/50 text-slate-900 dark:text-slate-100 rounded-sm px-0.5">$1</mark>');
        } catch (e) {
            // Fallback to original content if regex fails
            console.error("Highlight regex error", e);
        }
    }

    return (
        <div className={`prose prose-sm dark:prose-invert max-w-none 
                prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800
                prose-code:text-violet-600 dark:prose-code:text-violet-400 prose-code:bg-slate-100 dark:prose-code:bg-slate-800/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
                ${className || ''}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight, rehypeRaw]}
                components={{
                    // Custom link rendering to open in new tab
                    a: ({ node, ...props }: any) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline" />
                    ),
                    // Tables
                    table: ({ node, ...props }: any) => (
                        <div className="overflow-x-auto my-4 border rounded-lg border-slate-200 dark:border-slate-700">
                            <table {...props} className="w-full text-sm text-left border-collapse" />
                        </div>
                    ),
                    thead: ({ node, ...props }: any) => (
                        <thead {...props} className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-700 dark:text-slate-300 font-semibold" />
                    ),
                    tbody: ({ node, ...props }: any) => (
                        <tbody {...props} className="divide-y divide-slate-200 dark:divide-slate-700" />
                    ),
                    tr: ({ node, ...props }: any) => (
                        <tr {...props} className="bg-white dark:bg-slate-900 even:bg-slate-50 dark:even:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" />
                    ),
                    th: ({ node, ...props }: any) => (
                        <th {...props} className="px-4 py-3 border-b border-slate-200 dark:border-slate-700" />
                    ),
                    td: ({ node, ...props }: any) => (
                        <td {...props} className="px-4 py-3" />
                    ),
                    // Headings
                    h1: ({ node, ...props }: any) => <h1 {...props} className="text-3xl font-bold mt-8 mb-4 text-slate-900 dark:text-white border-b pb-2 border-slate-200 dark:border-slate-800" />,
                    h2: ({ node, ...props }: any) => <h2 {...props} className="text-2xl font-bold mt-6 mb-3 text-slate-900 dark:text-white" />,
                    h3: ({ node, ...props }: any) => <h3 {...props} className="text-xl font-bold mt-5 mb-2 text-slate-900 dark:text-white" />,
                    h4: ({ node, ...props }: any) => <h4 {...props} className="text-lg font-bold mt-4 mb-2 text-slate-900 dark:text-white" />,
                    h5: ({ node, ...props }: any) => <h5 {...props} className="text-base font-bold mt-4 mb-1 text-slate-900 dark:text-white" />,
                    h6: ({ node, ...props }: any) => <h6 {...props} className="text-sm font-bold mt-4 mb-1 text-slate-900 dark:text-white uppercase tracking-wide" />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};
