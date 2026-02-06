/**
 * @fileoverview Bulk Import Modal for Excel Prompt Import
 * 
 * Features:
 * - Excel file upload with xlsx library
 * - Preview parsed data before submission
 * - Validation of required fields
 * - Auto-create missing tags before import
 * - Download template button
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Table, Upload, Alert, Space, Tag } from 'antd';
import { Upload as UploadIcon, Download, FileText, AlertCircle, CheckCircle, Tag as TagIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { promptService } from '../api/promptService';
import { CreatePromptDto, PromptTag } from '../types/prompt';
import { globalMessage } from '@/app/App';

// ============================================================================
// Types
// ============================================================================

interface ParsedRow {
    prompt: string;
    description: string;
    tags: string[];
    source: string;
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

/**
 * Dark color palette for auto-created tags.
 */
const DARK_COLOR_PALETTE = [
    '#1E40AF', '#1E3A8A', '#059669', '#047857',
    '#7C3AED', '#6D28D9', '#DB2777', '#BE185D',
    '#DC2626', '#B91C1C', '#D97706', '#B45309',
    '#0891B2', '#0E7490', '#4F46E5', '#4338CA',
    '#16A34A', '#15803D', '#9333EA', '#7E22CE',
];

/**
 * Generate a random dark color from the palette.
 */
const generateRandomColor = (): string => {
    const index = Math.floor(Math.random() * DARK_COLOR_PALETTE.length);
    return DARK_COLOR_PALETTE[index] ?? '#1E40AF';
};

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
    // Map of tag name to color for preview display
    const [tagColorMap, setTagColorMap] = useState<Map<string, string>>(new Map());

    /**
     * Generate and download an Excel template file.
     * Includes examples for all columns.
     */
    const handleDownloadTemplate = useCallback(() => {
        // Create sample data for template
        const templateData = [
            {
                prompt: 'You are a helpful AI assistant. Please answer questions clearly and concisely.',
                description: 'A general-purpose assistant prompt',
                tags: 'assistant,general,helpful',
                source: 'chat'
            },
            {
                prompt: 'Summarize the following text in 3 bullet points:\n- Focus on the main ideas\n- Keep each point under 20 words\n- Use simple language',
                description: 'A multi-line summarization prompt',
                tags: 'writing,summary',
                source: 'chat'
            },
            {
                prompt: 'Translate the following text to Japanese:',
                description: 'Simple translation prompt',
                tags: 'translation,japanese',
                source: 'chat'
            }
        ];

        // Create workbook and worksheet
        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Prompts');

        // Set column widths for better readability
        worksheet['!cols'] = [
            { wch: 60 }, // prompt
            { wch: 40 }, // description
            { wch: 30 }, // tags
            { wch: 15 }, // source
        ];

        // Generate and download
        XLSX.writeFile(workbook, 'prompts_template.xlsx');
    }, []);

    /**
     * Parse Excel file using xlsx library.
     */
    const handleFileUpload = useCallback(async (file: File) => {
        // Reset state
        setParsedData([]);
        setParseError(null);
        setImportResult(null);
        setFileName(file.name);
        setTagColorMap(new Map());

        // Check file size
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            setParseError(t('prompts.bulkImport.errors.fileTooLarge', { max: MAX_FILE_SIZE_MB }));
            return false;
        }

        // Fetch existing tags for color mapping
        let existingTags: PromptTag[] = [];
        try {
            existingTags = await promptService.searchTags('', 1000);
        } catch (error) {
            console.error('Failed to fetch existing tags:', error);
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });

                // Get first sheet
                const sheetName = workbook.SheetNames[0];
                if (!sheetName) {
                    setParseError(t('prompts.bulkImport.errors.emptyFile'));
                    return;
                }

                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) {
                    setParseError(t('prompts.bulkImport.errors.emptyFile'));
                    return;
                }
                const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

                // Check for required columns
                if (jsonData.length === 0) {
                    setParseError(t('prompts.bulkImport.errors.noData'));
                    return;
                }

                const headers = Object.keys(jsonData[0] || {});
                const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
                if (missingColumns.length > 0) {
                    setParseError(t('prompts.bulkImport.errors.missingColumns', { columns: missingColumns.join(', ') }));
                    return;
                }

                // Check row limit
                if (jsonData.length > MAX_ROWS) {
                    setParseError(t('prompts.bulkImport.errors.tooManyRows', { max: MAX_ROWS }));
                    return;
                }

                // Parse and validate rows
                const parsed: ParsedRow[] = jsonData.map((row, index) => {
                    const promptValue = String(row.prompt || '').trim();
                    const tagsValue = String(row.tags || '').trim();

                    const parsedRow: ParsedRow = {
                        prompt: promptValue,
                        description: String(row.description || '').trim() || '',
                        tags: tagsValue ? tagsValue.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
                        source: String(row.source || '').trim() || ''
                    };

                    // Validate required field
                    if (!parsedRow.prompt) {
                        parsedRow._error = t('prompts.bulkImport.errors.missingPrompt', { row: index + 2 }); // +2 for header row
                    }

                    return parsedRow;
                });

                setParsedData(parsed);

                // Build tag color map from parsed data
                const newColorMap = new Map<string, string>();
                const allParsedTags = new Set<string>();
                parsed.forEach(row => {
                    row.tags.forEach(tag => allParsedTags.add(tag));
                });
                allParsedTags.forEach(tagName => {
                    const existingTag = existingTags.find(t => t.name === tagName);
                    if (existingTag) {
                        newColorMap.set(tagName, existingTag.color);
                    } else {
                        // New tag - assign random color
                        newColorMap.set(tagName, generateRandomColor());
                    }
                });
                setTagColorMap(newColorMap);
            } catch (error: any) {
                setParseError(error.message || t('prompts.bulkImport.parseError'));
            }
        };

        reader.onerror = () => {
            setParseError(t('prompts.bulkImport.parseError'));
        };

        reader.readAsArrayBuffer(file);
        return false; // Prevent default upload behavior
    }, [t]);

    /**
     * Create missing tags before import.
     * @param allTags - Array of all tag names from parsed data
     * @returns Map of tag name to tag object
     */
    const ensureTagsExist = async (allTags: string[]): Promise<Map<string, PromptTag>> => {
        const tagMap = new Map<string, PromptTag>();
        if (allTags.length === 0) return tagMap;

        try {
            // Get existing tags
            const existingTags = await promptService.searchTags('', 100);
            existingTags.forEach(tag => tagMap.set(tag.name, tag));

            // Find missing tags
            const missingTags = allTags.filter(tagName => !tagMap.has(tagName));

            // Create missing tags
            for (const tagName of missingTags) {
                try {
                    const color = generateRandomColor();
                    const newTag = await promptService.createTag(tagName, color);
                    tagMap.set(newTag.name, newTag);
                } catch (error) {
                    console.error(`Failed to create tag "${tagName}":`, error);
                    // Continue with other tags even if one fails
                }
            }
        } catch (error) {
            console.error('Failed to fetch existing tags:', error);
        }

        return tagMap;
    };

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
            // Collect all unique tags
            const allTags = new Set<string>();
            validData.forEach(row => {
                row.tags?.forEach(tag => allTags.add(tag));
            });

            // Ensure all tags exist (create missing ones)
            await ensureTagsExist(Array.from(allTags));

            // Create prompts
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
            // Close modal after successful import
            handleClose();
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
            width: '50%',
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
            width: '30%',
            render: (text: string) => (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {text}
                </div>
            )
        },
        {
            title: t('prompts.fields.tags'),
            dataIndex: 'tags',
            key: 'tags',
            width: '15%',
            render: (tags: string[] | undefined) => (
                <div className="flex flex-wrap gap-y-2 gap-x-1">
                    {(tags || []).map((tagName, i) => {
                        const color = tagColorMap.get(tagName);
                        return (
                            <Tag
                                key={i}
                                className="border-none px-2 py-1 inline-flex items-center gap-1.5 rounded-md m-0"
                                style={color ? { backgroundColor: color, color: '#fff' } : {}}
                            >
                                <span className="font-medium">{tagName}</span>
                                <TagIcon size={12} className="text-white opacity-90" />
                            </Tag>
                        );
                    })}
                </div>
            )
        },
        {
            title: t('prompts.fields.source') || 'Source',
            dataIndex: 'source',
            key: 'source',
            width: '5%'
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
            closable={!loading}
            maskClosable={!loading}
            width="70%"
            footer={
                <div className="flex justify-between items-center">
                    <Button
                        icon={<Download size={16} />}
                        onClick={handleDownloadTemplate}
                    >
                        {t('prompts.bulkImport.downloadTemplate')}
                    </Button>
                    <Space>
                        <Button onClick={handleClose} disabled={loading}>
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
            styles={{
                body: { height: 'calc(80vh - 120px)', overflowY: 'auto' }
            }}
        >
            <div className="space-y-4">
                {/* Instructions */}
                <Alert
                    title={t('prompts.bulkImport.instructions')}
                    description={
                        <ul className="list-disc ml-4 mt-2 text-sm">
                            <li>{t('prompts.bulkImport.instructionColumns', { required: 'prompt', optional: OPTIONAL_COLUMNS.join(', ') })}</li>
                            <li>{t('prompts.bulkImport.instructionTags')}</li>
                            <li>{t('prompts.bulkImport.instructionAutoTags')}</li>
                        </ul>
                    }
                    type="info"
                    showIcon
                />

                {/* Upload Area */}
                {!parsedData.length && !parseError && (
                    <Upload.Dragger
                        accept=".xlsx,.xls"
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
                        title={t('prompts.bulkImport.parseError')}
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
                        <div className="flex items-center justify-between flex-nowrap gap-4">
                            <span className="text-sm text-slate-500 whitespace-nowrap">
                                {t('prompts.bulkImport.fileLoaded', { name: fileName })}
                            </span>
                            <Space className="flex-shrink-0">
                                {validCount > 0 && (
                                    <Tag icon={<CheckCircle size={12} />} color="success" className="whitespace-nowrap inline-flex items-center gap-1 !flex-nowrap">
                                        {t('prompts.bulkImport.validRows', { count: validCount })}
                                    </Tag>
                                )}
                                {errorCount > 0 && (
                                    <Tag icon={<AlertCircle size={12} />} color="error" className="whitespace-nowrap inline-flex items-center gap-1 !flex-nowrap">
                                        {t('prompts.bulkImport.errorRows', { count: errorCount })}
                                    </Tag>
                                )}
                            </Space>
                        </div>
                        <Table
                            columns={columns}
                            dataSource={parsedData}
                            rowKey={(record: ParsedRow, index?: number) => `${record.prompt?.substring(0, 50)}-${index}`}
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
