/**
 * @fileoverview Glossary Bulk Import Modal
 *
 * Parses Excel files with columns:
 *   task_name, task_instruction_en, task_instruction_ja, task_instruction_vi, context_template
 * Previews data in a table, then sends to the bulk-import API.
 */

import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, FileSpreadsheet, AlertCircle, Download } from 'lucide-react'
import {
    Modal, Button, Table, Alert, Space
} from 'antd'
import * as XLSX from 'xlsx'
import { glossaryApi, type BulkImportRow, type BulkImportResult } from '../api/glossaryApi'
import { globalMessage } from '@/app/App'

// ============================================================================
// Props
// ============================================================================

interface GlossaryBulkImportModalProps {
    open: boolean
    onClose: () => void
    onSuccess: () => void
}

// ============================================================================
// Component
// ============================================================================

export const GlossaryBulkImportModal = ({ open, onClose, onSuccess }: GlossaryBulkImportModalProps) => {
    const { t } = useTranslation()

    const [parsedRows, setParsedRows] = useState<BulkImportRow[]>([])
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState<BulkImportResult | null>(null)
    const [parseError, setParseError] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    // ========================================================================
    // File Parsing
    // ========================================================================

    /** Parse an Excel file and extract bulk import rows. */
    const processFile = useCallback((file: File) => {
        setParseError(null)
        setImportResult(null)
        setParsedRows([])

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer)
                const workbook = XLSX.read(data, { type: 'array' })
                const sheet = workbook.Sheets[workbook.SheetNames[0]!]
                if (!sheet) {
                    setParseError(t('glossary.bulkImport.noSheet'))
                    return
                }

                const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)

                if (jsonData.length === 0) {
                    setParseError(t('glossary.bulkImport.emptyFile'))
                    return
                }

                const firstRow = jsonData[0]!
                const requiredCols = ['task_name', 'task_instruction_en', 'context_template']
                const missingCols = requiredCols.filter((col) => !(col in firstRow))
                if (missingCols.length > 0) {
                    setParseError(t('glossary.bulkImport.missingColumns', { cols: missingCols.join(', ') }))
                    return
                }

                const rows: BulkImportRow[] = jsonData
                    .filter((row) => row.task_name)
                    .map((row) => ({
                        task_name: row.task_name?.trim() || '',
                        task_instruction_en: row.task_instruction_en?.trim() || '',
                        task_instruction_ja: row.task_instruction_ja?.trim() || '',
                        task_instruction_vi: row.task_instruction_vi?.trim() || '',
                        context_template: row.context_template?.trim() || '',
                    }))

                if (rows.length === 0) {
                    setParseError(t('glossary.bulkImport.noValidRows'))
                    return
                }

                setParsedRows(rows)
            } catch (err: any) {
                console.error('Excel parse error:', err)
                setParseError(err.message || t('glossary.bulkImport.parseError'))
            }
        }
        reader.readAsArrayBuffer(file)
    }, [t])

    /** Handle file input change. */
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        processFile(file)
        e.target.value = ''
    }, [processFile])

    // ========================================================================
    // Drag & Drop
    // ========================================================================

    /** Counter to track nested drag enter/leave events from child elements. */
    const dragCounter = useRef(0)

    /** Prevent default to allow drop. */
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    /** Increment counter and show highlight. */
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current++
        if (dragCounter.current === 1) setIsDragging(true)
    }, [])

    /** Decrement counter and hide highlight when fully left. */
    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current--
        if (dragCounter.current === 0) setIsDragging(false)
    }, [])

    /** Process dropped file and reset counter. */
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current = 0
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            processFile(file)
        } else {
            setParseError(t('glossary.bulkImport.parseError'))
        }
    }, [processFile, t])

    // ========================================================================
    // Download Template
    // ========================================================================

    /** Generate and download a sample Excel template with example rows. */
    const downloadTemplate = useCallback(() => {
        const sampleRows = [
            { task_name: 'Document Search', task_instruction_en: 'Use these terms to improve document search accuracy', task_instruction_ja: 'これらのキーワードを使って文書検索の精度を向上させてください', task_instruction_vi: 'Sử dụng các từ khóa này để cải thiện độ chính xác tìm kiếm tài liệu', context_template: 'Search for {keyword} related information' },
            { task_name: 'FAQ Generation', task_instruction_en: 'Generate FAQ pairs for common questions', task_instruction_ja: 'よくある質問に対するFAQペアを生成してください', task_instruction_vi: 'Tạo các cặp FAQ cho những câu hỏi phổ biến', context_template: 'Generate FAQ about {keyword}' },
            { task_name: 'Knowledge Base', task_instruction_en: 'Build and maintain knowledge base entries', task_instruction_ja: 'ナレッジベースのエントリを作成・維持してください', task_instruction_vi: 'Xây dựng và duy trì các mục cơ sở kiến thức', context_template: 'Create knowledge base entry for {keyword}' },
        ]
        const ws = XLSX.utils.json_to_sheet(sampleRows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Glossary Import')
        XLSX.writeFile(wb, 'glossary_task_import_template.xlsx')
    }, [])

    // ========================================================================
    // Import
    // ========================================================================

    const handleImport = async () => {
        if (parsedRows.length === 0) return
        setImporting(true)
        setImportResult(null)
        try {
            const result = await glossaryApi.bulkImport(parsedRows)
            setImportResult(result)
            if (result.success) {
                globalMessage.success(t('glossary.bulkImport.success'))
                onSuccess()
                handleClose()
            }
        } catch (error: any) {
            globalMessage.error(error?.message || t('common.error'))
        } finally {
            setImporting(false)
        }
    }

    // ========================================================================
    // Reset & Close
    // ========================================================================

    const handleClose = () => {
        setParsedRows([])
        setImportResult(null)
        setParseError(null)
        onClose()
    }

    // ========================================================================
    // Preview Columns
    // ========================================================================

    const previewColumns = [
        { title: t('glossary.bulkImport.colTaskName'), dataIndex: 'task_name', key: 'task_name', width: 150 },
        { title: t('glossary.bulkImport.colTaskInstructionEn'), dataIndex: 'task_instruction_en', key: 'task_instruction_en', ellipsis: true },
        { title: t('glossary.bulkImport.colTaskInstructionJa'), dataIndex: 'task_instruction_ja', key: 'task_instruction_ja', ellipsis: true },
        { title: t('glossary.bulkImport.colTaskInstructionVi'), dataIndex: 'task_instruction_vi', key: 'task_instruction_vi', ellipsis: true },
        { title: t('glossary.bulkImport.colContextTemplate'), dataIndex: 'context_template', key: 'context_template', ellipsis: true },
    ]

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <FileSpreadsheet size={20} />
                    <span>{t('glossary.bulkImport.title')}</span>
                </div>
            }
            open={open}
            onCancel={handleClose}
            width="70%"
            style={{ top: '10%' }}
            footer={
                <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">
                        {parsedRows.length > 0
                            ? t('glossary.bulkImport.rowCount', { count: parsedRows.length })
                            : ''}
                    </span>
                    <Space>
                        <Button onClick={handleClose}>{t('common.cancel')}</Button>
                        <Button
                            type="primary"
                            onClick={handleImport}
                            loading={importing}
                            disabled={parsedRows.length === 0 || importing}
                        >
                            {t('glossary.bulkImport.import')}
                        </Button>
                    </Space>
                </div>
            }
            destroyOnClose
        >
            <div className="space-y-4">
                {/* File Upload Area — supports click and drag & drop */}
                <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                        isDragging
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-300 dark:border-slate-600'
                    }`}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <label className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload size={32} className="text-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                            {t('glossary.bulkImport.selectFile')}
                        </span>
                        <span className="text-xs text-slate-400">
                            {t('glossary.bulkImport.fileFormat')}
                        </span>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                    </label>
                    <Button
                        type="link"
                        icon={<Download size={14} />}
                        onClick={downloadTemplate}
                        className="mt-2"
                        size="small"
                    >
                        {t('glossary.bulkImport.downloadTemplate')}
                    </Button>
                </div>

                {/* Parse Error */}
                {parseError && (
                    <Alert
                        type="error"
                        message={parseError}
                        icon={<AlertCircle size={16} />}
                        showIcon
                        closable
                        onClose={() => setParseError(null)}
                    />
                )}

                {/* Import Result */}
                {importResult && (
                    <Alert
                        type={importResult.success ? 'success' : 'warning'}
                        message={
                            <div>
                                <p>{t('glossary.bulkImport.resultSummary', {
                                    tasks: importResult.tasksCreated,
                                    skipped: importResult.skipped,
                                })}</p>
                                {importResult.errors.length > 0 && (
                                    <ul className="mt-1 text-sm">
                                        {importResult.errors.map((err, i) => (
                                            <li key={i}>• {err}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        }
                        showIcon
                    />
                )}

                {/* Preview Table */}
                {parsedRows.length > 0 && (
                    <div className="max-h-[400px] overflow-auto">
                        <Table
                            columns={previewColumns}
                            dataSource={parsedRows.map((row, i) => ({ ...row, key: i }))}
                            pagination={false}
                            size="small"
                            scroll={{ x: true }}
                        />
                    </div>
                )}
            </div>
        </Modal>
    )
}
