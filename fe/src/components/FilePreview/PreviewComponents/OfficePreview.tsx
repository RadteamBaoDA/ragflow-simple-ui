import React, { useEffect, useState } from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

interface OfficePreviewProps {
    url: string;
}

// Simple in-memory cache for file content
const fileCache = new Map<string, ArrayBuffer>();

export const OfficePreview: React.FC<OfficePreviewProps> = ({ url }) => {
    const [content, setContent] = useState<React.ReactNode | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAndRender = async () => {
            try {
                setLoading(true);
                setError(null);

                // Determine file type from URL
                // We assume the URL contains the extension or we fall back to checking the response content type if needed,
                // but for now relying on the URL path is the simplest integration with MinIO presigned URLs.
                const urlPath = url.split('?')[0] || '';
                const extension = urlPath.split('.').pop()?.toLowerCase();

                // Check cache first
                if (fileCache.has(url)) {
                    console.log('Using cached file content');
                    const arrayBuffer = fileCache.get(url)!;
                    await processFile(arrayBuffer, extension);
                    setLoading(false);
                    return;
                }

                const response = await fetch(url);
                if (!response.ok) throw new Error('Failed to download file');
                const arrayBuffer = await response.arrayBuffer();

                // Cache the result
                fileCache.set(url, arrayBuffer);

                await processFile(arrayBuffer, extension);

            } catch (err) {
                console.error('Preview error:', err);
                setError('Failed to load document preview.');
            } finally {
                setLoading(false);
            }
        };

        const processFile = async (arrayBuffer: ArrayBuffer, extension: string | undefined) => {
            if (extension === 'docx') {
                await renderDocx(arrayBuffer);
            } else if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
                renderExcel(arrayBuffer);
            } else if (extension === 'pptx' || extension === 'ppt') {
                renderPptxFallback();
            } else {
                // Fallback or error for unknown types
                setError('Unsupported office file type for local preview.');
            }
        };

        fetchAndRender();
    }, [url]);

    const renderDocx = async (arrayBuffer: ArrayBuffer) => {
        try {
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setContent(
                <div
                    className="prose dark:prose-invert max-w-none p-8 bg-white dark:bg-gray-900 shadow-sm min-h-full"
                    dangerouslySetInnerHTML={{ __html: result.value }}
                />
            );
        } catch (e) {
            throw new Error('Failed to render DOCX');
        }
    };

    const renderExcel = (arrayBuffer: ArrayBuffer) => {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        if (workbook.SheetNames.length === 0) {
            throw new Error('No sheets found in Excel file');
        }
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            throw new Error('Invalid sheet name');
        }
        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) {
            throw new Error('Sheet not found');
        }
        const html = XLSX.utils.sheet_to_html(worksheet, { id: 'excel-preview', editable: false });

        // Sanitize and style the HTML table
        setContent(
            <div className="p-4 bg-white dark:bg-gray-900 min-h-full overflow-auto">
                <style>{`
                    #excel-preview { border-collapse: collapse; width: 100%; }
                    #excel-preview td, #excel-preview th { border: 1px solid #ddd; padding: 8px; }
                    #excel-preview tr:nth-child(even) { background-color: #f2f2f2; }
                    .dark #excel-preview td, .dark #excel-preview th { border-color: #444; }
                    .dark #excel-preview tr:nth-child(even) { background-color: #1f2937; }
                `}</style>
                <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
        );
    };

    const renderPptxFallback = () => {
        setContent(
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8 text-center">
                <AlertTriangle className="w-16 h-16 mb-4 text-amber-500" />
                <h3 className="text-xl font-semibold mb-2">Preview Unavailable</h3>
                <p className="max-w-md">
                    Slideshow previews are not supported in offline mode. Please download the file to view it.
                </p>
            </div>
        );
    };

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
        <div className="w-full h-full bg-gray-100 dark:bg-gray-950 overflow-auto">
            {content}
        </div>
    );
};
