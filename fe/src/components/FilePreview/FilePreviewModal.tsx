/**
 * @fileoverview Modal component for previewing files.
 * Routes to specific previewers based on file extension.
 */

import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ImagePreview } from './PreviewComponents/ImagePreview';
import { PdfPreview } from './PreviewComponents/PdfPreview';
import { TextPreview } from './PreviewComponents/TextPreview';
import { OfficePreview } from './PreviewComponents/OfficePreview';

/**
 * File object type
 */
interface FileObject {
  name: string;
  size?: number;
  lastModified?: Date;
}

/**
 * @description Props for the FilePreviewModal.
 */
interface FilePreviewModalProps {
  /** File object with metadata (name, size, etc.) */
  file: FileObject;
    /** Presigned URL for accessing the file content */
    url: string;
    /** Callback to close the modal */
    onClose: () => void;
    /** Callback to trigger file download (browser download) */
    onDownload: () => void;
}

/**
 * @description A modal dialog that renders a preview of a file stored in MinIO.
 * It detects the file extension and chooses the appropriate sub-component:
 * - Images (jpg, png, etc.) -> ImagePreview
 * - PDFs -> PdfPreview
 * - Text/Code (txt, json, js, etc.) -> TextPreview
 * - Office Docs (docx, xlsx, pptx) -> OfficePreview (via Microsoft Online Viewer)
 * - Others -> Fallback with download button.
 *
 * It also provides a toolbar for downloading, opening in a new tab, and closing.
 *
 * @param {FilePreviewModalProps} props - Component properties.
 * @returns {JSX.Element} The file preview modal.
 */
export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, url, onClose, onDownload }) => {
    const { t } = useTranslation();
    const [extension, setExtension] = useState<string>('');

    useEffect(() => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        console.log('[FilePreviewModal] Opening file:', { name: file.name, ext, url });
        setExtension(ext);
    }, [file, url]);

    const renderPreview = () => {
        switch (extension) {
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'webp':
            case 'svg':
            case 'bmp':
                return <ImagePreview url={url} alt={file.name} />;

            case 'pdf':
                return <PdfPreview url={url} title={file.name} />;

            case 'txt':
            case 'md':
            case 'json':
            case 'xml':
            case 'log':
            case 'css':
            case 'js':
            case 'ts':
            case 'tsx':
            case 'jsx':
            case 'yml':
            case 'yaml':
                return <TextPreview url={url} extension={extension} />;

            case 'doc':
            case 'docx':
            case 'xls':
            case 'xlsx':
            case 'ppt':
            case 'pptx':
                return <OfficePreview url={url} />;

            default:
                return (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8 text-center">
                        <AlertCircle className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">{t('documents.previewNotSupported', 'Preview not supported for this file type')}</p>
                        <p className="text-sm mb-6">{file.name}</p>
                        <button
                            onClick={onDownload}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            {t('documents.download')}
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden relative border border-gray-200 dark:border-gray-800">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={file.name}>
                            {file.name}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono">
                            {extension.toUpperCase()}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onDownload}
                            className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title={t('documents.download')}
                        >
                            <Download className="w-5 h-5" />
                        </button>
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title={t('documents.openNewTab', 'Open in new tab')}
                        >
                            <ExternalLink className="w-5 h-5" />
                        </a>
                        <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title={t('common.close')}
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-950 relative">
                    {renderPreview()}
                </div>
            </div>
        </div>
    );
};
