/**
 * @fileoverview Bulk Import Modal for CSV Prompt Import
 * 
 * Features:
 * - CSV file upload with papaparse
 * - Preview parsed data before submission
 * - Validation of required fields
 * - Download template button
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Table, Upload, Alert, Space, Tag } from 'antd';
import { Upload as UploadIcon, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { promptService } from '../api/promptService';
import { CreatePromptDto } from '../types/prompt';
import { globalMessage } from '@/app/App';

// ============================================================================
// Types
// ============================================================================

interface ParsedRow {
    prompt: string;
    description?: string;
    tags?: string[];
    source?: string;
    _error?: string;
}

interface BulkImportModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const REQUIRED_COLUMNS = ['prompt'];
const OPTIONAL_COLUMNS = ['description', 'tags', 'source'];
const MAX_ROWS = 1000;
const MAX_FILE_SIZE_MB = 5;

// ============================================================================
// Component
// ============================================================================

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ open, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [parseError, setParseError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

    /**
     * Generate and download a CSV template file.
     * Includes examples for all columns and a multi-line prompt sample.
     */
    const handleDownloadTemplate = useCallback(() => {
        const templateContent = `prompt,description,tags,source
"You are a helpful AI assistant. Please answer questions clearly and concisely.",A general-purpose assistant prompt for everyday use,"assistant,general,helpful",template
"Summarize the following text in 3 bullet points:
- Focus on the main ideas
- Keep each point under 20 words
- Use simple language",A multi-line summarization prompt with instructions,"writing,summary,multiline",template
"Translate the following text to Japanese:",Simple translation prompt,"translation,japanese",template`;
        const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'prompts_template.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    /**
     * Parse CSV file using papaparse.
     */
    const handleFileUpload = useCallback((file: File) => {
        // Reset state
        setParsedData([]);
        setParseError(null);
        setImportResult(null);
        setFileName(file.name);

        // Check file size
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            setParseError(t('prompts.bulkImport.errors.fileTooLarge', { max: MAX_FILE_SIZE_MB }));
            return false;
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const { data, errors, meta } = results;

                // Check for parsing errors
                if (errors.length > 0) {
                    setParseError(errors.map(e => e.message).join(', '));
                    return;
                }

                // Check for required columns
                const headers = meta.fields || [];
                const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
                if (missingColumns.length > 0) {
                    setParseError(t('prompts.bulkImport.errors.missingColumns', { columns: missingColumns.join(', ') }));
                    return;
                }

                // Check row limit
                if (data.length > MAX_ROWS) {
                    setParseError(t('prompts.bulkImport.errors.tooManyRows', { max: MAX_ROWS }));
                    return;
                }

                // Parse and validate rows
                const parsed: ParsedRow[] = (data as any[]).map((row, index) => {
                    const parsedRow: ParsedRow = {
                        prompt: row.prompt?.trim() || '',
                        description: row.description?.trim() || undefined,
                        tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined,
                        source: row.source?.trim() || undefined
                    };

                    // Validate required field
                    if (!parsedRow.prompt) {
                        parsedRow._error = t('prompts.bulkImport.errors.missingPrompt', { row: index + 1 });
                    }

                    return parsedRow;
                });

                setParsedData(parsed);
            },
            error: (error) => {
                setParseError(error.message);
            }
        });

        return false; // Prevent default upload behavior
    }, [t]);

    /**
     * Submit parsed data to backend.
     */
    const handleSubmit = async () => {
        const validData = parsedData.filter(row => !row._error);
        if (validData.length === 0) {
            globalMessage.error(t('prompts.bulkImport.errors.noValidData'));
            return;
        }

        setLoading(true);
        try {
            const prompts: CreatePromptDto[] = validData.map(row => {
                const dto: CreatePromptDto = { prompt: row.prompt };
                if (row.description) dto.description = row.description;
                if (row.tags) dto.tags = row.tags;
                if (row.source) dto.source = row.source;
                return dto;
            });
            const result = await promptService.bulkCreate(prompts);
            setImportResult({ imported: result.imported, skipped: result.skipped });
            globalMessage.success(t('prompts.bulkImport.success', { imported: result.imported, skipped: result.skipped }));
            onSuccess();
        } catch (error: any) {
            const message = error?.response?.data?.error || error?.message || t('common.error');
            globalMessage.error(message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Reset modal state on close.
     */
    const handleClose = () => {
        setParsedData([]);
        setParseError(null);
        setFileName(null);
        setImportResult(null);
        onClose();
    };

    // Table columns for preview
    const columns = [
        {
            title: t('prompts.fields.prompt'),
            dataIndex: 'prompt',
            key: 'prompt',
            width: '40%',
            render: (text: string, record: ParsedRow) => (
                <div>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {text?.substring(0, 200)}{text?.length > 200 ? '...' : ''}
                    </div>
                    {record._error && (
                        <span className="text-red-500 text-xs flex items-center gap-1 mt-1">
                            <AlertCircle size={12} />
                            {record._error}
                        </span>
                    )}
                </div>
            )
        },
        {
            title: t('prompts.fields.description'),
            dataIndex: 'description',
            key: 'description',
            width: '25%',
            ellipsis: true
        },
        {
            title: t('prompts.fields.tags'),
            dataIndex: 'tags',
            key: 'tags',
            render: (tags: string[] | undefined) => (
                <div className="flex flex-wrap gap-1">
                    {(tags || []).map((tag, i) => (
                        <Tag key={i}>{tag}</Tag>
                    ))}
                </div>
            )
        },
        {
            title: t('prompts.fields.source') || 'Source',
            dataIndex: 'source',
            key: 'source'
        }
    ];

    const validCount = parsedData.filter(row => !row._error).length;
    const errorCount = parsedData.filter(row => row._error).length;

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <UploadIcon size={20} />
                    <span>{t('prompts.bulkImport.title')}</span>
                </div>
            }
            open={open}
            onCancel={handleClose}
            width={900}
            footer={
                <div className="flex justify-between items-center">
                    <Button
                        icon={<Download size={16} />}
                        onClick={handleDownloadTemplate}
                    >
                        {t('prompts.bulkImport.downloadTemplate')}
                    </Button>
                    <Space>
                        <Button onClick={handleClose}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleSubmit}
                            loading={loading}
                            disabled={validCount === 0 || importResult !== null}
                        >
                            {t('prompts.bulkImport.import')} ({validCount})
                        </Button>
                    </Space>
                </div>
            }
        >
            <div className="space-y-4">
                {/* Instructions */}
                <Alert
                    message={t('prompts.bulkImport.instructions')}
                    description={
                        <ul className="list-disc ml-4 mt-2 text-sm">
                            <li>{t('prompts.bulkImport.instructionColumns', { required: 'prompt', optional: OPTIONAL_COLUMNS.join(', ') })}</li>
                            <li>{t('prompts.bulkImport.instructionMultiline')}</li>
                            <li>{t('prompts.bulkImport.instructionTags')}</li>
                        </ul>
                    }
                    type="info"
                    showIcon
                />

                {/* Upload Area */}
                {!parsedData.length && !parseError && (
                    <Upload.Dragger
                        accept=".csv"
                        showUploadList={false}
                        beforeUpload={handleFileUpload}
                        className="!p-8"
                    >
                        <p className="ant-upload-drag-icon">
                            <FileText size={48} className="mx-auto text-blue-500" />
                        </p>
                        <p className="ant-upload-text">{t('prompts.bulkImport.dropzone')}</p>
                        <p className="ant-upload-hint">{t('prompts.bulkImport.dropzoneHint')}</p>
                    </Upload.Dragger>
                )}

                {/* Parse Error */}
                {parseError && (
                    <Alert
                        message={t('prompts.bulkImport.parseError')}
                        description={parseError}
                        type="error"
                        showIcon
                        action={
                            <Button size="small" onClick={() => {
                                setParseError(null);
                                setFileName(null);
                            }}>
                                {t('common.retry')}
                            </Button>
                        }
                    />
                )}

                {/* Preview Table */}
                {parsedData.length > 0 && (
                    <>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">
                                {t('prompts.bulkImport.fileLoaded', { name: fileName })}
                            </span>
                            <Space>
                                {validCount > 0 && (
                                    <Tag icon={<CheckCircle size={12} />} color="success">
                                        {t('prompts.bulkImport.validRows', { count: validCount })}
                                    </Tag>
                                )}
                                {errorCount > 0 && (
                                    <Tag icon={<AlertCircle size={12} />} color="error">
                                        {t('prompts.bulkImport.errorRows', { count: errorCount })}
                                    </Tag>
                                )}
                            </Space>
                        </div>
                        <Table
                            columns={columns}
                            dataSource={parsedData}
                            rowKey={(_: ParsedRow, index: number | undefined) => `row-${index}`}
                            pagination={{ pageSize: 5 }}
                            size="small"
                            scroll={{ x: true }}
                            rowClassName={(record: ParsedRow) => record._error ? 'bg-red-50 dark:bg-red-900/20' : ''}
                        />
                    </>
                )}

                {/* Import Result */}
                {importResult && (
                    <Alert
                        message={t('prompts.bulkImport.resultTitle')}
                        description={t('prompts.bulkImport.resultMessage', { imported: importResult.imported, skipped: importResult.skipped })}
                        type="success"
                        showIcon
                    />
                )}
            </div>
        </Modal>
    );
};

export default BulkImportModal;
