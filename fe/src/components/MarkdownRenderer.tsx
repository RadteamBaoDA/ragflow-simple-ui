import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github-dark.css'; // Import a highlight.js theme

interface MarkdownRendererProps {
    children: string;
    className?: string; // Allow passing extra classes
    highlightText?: string;
}

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
                    a: ({ node, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline" />
                    ),
                    // Tables
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4 border rounded-lg border-slate-200 dark:border-slate-700">
                            <table {...props} className="w-full text-sm text-left border-collapse" />
                        </div>
                    ),
                    thead: ({ node, ...props }) => (
                        <thead {...props} className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-700 dark:text-slate-300 font-semibold" />
                    ),
                    tbody: ({ node, ...props }) => (
                        <tbody {...props} className="divide-y divide-slate-200 dark:divide-slate-700" />
                    ),
                    tr: ({ node, ...props }) => (
                        <tr {...props} className="bg-white dark:bg-slate-900 even:bg-slate-50 dark:even:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" />
                    ),
                    th: ({ node, ...props }) => (
                        <th {...props} className="px-4 py-3 border-b border-slate-200 dark:border-slate-700" />
                    ),
                    td: ({ node, ...props }) => (
                        <td {...props} className="px-4 py-3" />
                    ),
                    // Headings
                    h1: ({ node, ...props }) => <h1 {...props} className="text-3xl font-bold mt-8 mb-4 text-slate-900 dark:text-white border-b pb-2 border-slate-200 dark:border-slate-800" />,
                    h2: ({ node, ...props }) => <h2 {...props} className="text-2xl font-bold mt-6 mb-3 text-slate-900 dark:text-white" />,
                    h3: ({ node, ...props }) => <h3 {...props} className="text-xl font-bold mt-5 mb-2 text-slate-900 dark:text-white" />,
                    h4: ({ node, ...props }) => <h4 {...props} className="text-lg font-bold mt-4 mb-2 text-slate-900 dark:text-white" />,
                    h5: ({ node, ...props }) => <h5 {...props} className="text-base font-bold mt-4 mb-1 text-slate-900 dark:text-white" />,
                    h6: ({ node, ...props }) => <h6 {...props} className="text-sm font-bold mt-4 mb-1 text-slate-900 dark:text-white uppercase tracking-wide" />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};
