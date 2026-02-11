/**
 * @fileoverview Keyword Bulk Import Modal
 *
 * Parses Excel files with columns: name, en_keyword, description
 * Previews data, then sends to the keyword bulk-import API.
 * @module features/glossary/components/KeywordBulkImportModal
 */

import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, FileSpreadsheet, AlertCircle, Download } from 'lucide-react'
import { Modal, Button, Table, Alert, Space } from 'antd'
import * as XLSX from 'xlsx'
import {
    glossaryApi,
    type BulkImportKeywordRow,
    type BulkImportKeywordResult,
} from '../api/glossaryApi'
import { globalMessage } from '@/app/App'

// ============================================================================
// Props
// ============================================================================

/** Props for the KeywordBulkImportModal component. */
interface KeywordBulkImportModalProps {
    /** Whether the modal is visible. */
    open: boolean
    /** Callback to close the modal. */
    onClose: () => void
    /** Callback invoked after a successful import. */
    onSuccess: () => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * Modal for bulk importing keywords via Excel file.
 * @description User uploads an Excel file with columns (name, en_keyword, description),
 * previews the data, then imports keywords.
 * @param props - Component props.
 * @returns React element.
 */
export const KeywordBulkImportModal = ({ open, onClose, onSuccess }: KeywordBulkImportModalProps) => {
    const { t } = useTranslation()

    // State
    const [parsedRows, setParsedRows] = useState<BulkImportKeywordRow[]>([])
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState<BulkImportKeywordResult | null>(null)
    const [parseError, setParseError] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    // ========================================================================
    // File Parsing
    // ========================================================================

    /** Parse an Excel file and extract keyword rows. */
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
                    setParseError(t('glossary.keywordImport.noSheet'))
                    return
                }

                const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)

                if (jsonData.length === 0) {
                    setParseError(t('glossary.keywordImport.emptyFile'))
                    return
                }

                const firstRow = jsonData[0]!
                if (!('name' in firstRow)) {
                    setParseError(t('glossary.keywordImport.missingColumns', { cols: 'name' }))
                    return
                }

                const rows: BulkImportKeywordRow[] = jsonData
                    .filter((row) => row.name && row.name.trim())
                    .map((row) => {
                        const mapped: BulkImportKeywordRow = { name: row.name?.trim() || '' }
                        if (row.en_keyword?.trim()) mapped.en_keyword = row.en_keyword.trim()
                        if (row.description?.trim()) mapped.description = row.description.trim()
                        return mapped
                    })

                if (rows.length === 0) {
                    setParseError(t('glossary.keywordImport.noValidRows'))
                    return
                }

                setParsedRows(rows)
            } catch (err: any) {
                console.error('Excel parse error:', err)
                setParseError(err.message || t('glossary.keywordImport.parseError'))
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
            setParseError(t('glossary.keywordImport.parseError'))
        }
    }, [processFile, t])

    // ========================================================================
    // Download Template
    // ========================================================================

    /** Generate and download a sample Excel template with example keyword rows. */
    const downloadTemplate = useCallback(() => {
        const sampleRows = [
            { name: '契約書', en_keyword: 'Contract', description: 'Legal binding agreement document' },
            { name: '仕様書', en_keyword: 'Specification', description: 'Technical specification document' },
            { name: 'マニュアル', en_keyword: 'Manual', description: 'User or operation manual' },
            { name: '報告書', en_keyword: 'Report', description: 'Business or technical report' },
            { name: '設計書', en_keyword: 'Design Document', description: 'System or software design document' },
        ]
        const ws = XLSX.utils.json_to_sheet(sampleRows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Keyword Import')
        XLSX.writeFile(wb, 'glossary_keyword_import_template.xlsx')
    }, [])

    // ========================================================================
    // Import
    // ========================================================================

    /**
     * Send parsed rows to the keyword bulk-import API.
     */
    const handleImport = async () => {
        if (parsedRows.length === 0) return
        setImporting(true)
        setImportResult(null)
        try {
            const result = await glossaryApi.bulkImportKeywords(parsedRows)
            setImportResult(result)
            if (result.success) {
                globalMessage.success(t('glossary.keywordImport.success'))
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

    /**
     * Reset all state and close the modal.
     */
    const handleClose = () => {
        setParsedRows([])
        setImportResult(null)
        setParseError(null)
        onClose()
    }

    // ========================================================================
    // Preview Columns
    // ========================================================================

    /** Column definitions for the preview table. */
    const previewColumns = [
        { title: t('glossary.keyword.name'), dataIndex: 'name', key: 'name', width: 200 },
        { title: t('glossary.keyword.enKeyword'), dataIndex: 'en_keyword', key: 'en_keyword', width: 200 },
        { title: t('glossary.keyword.description'), dataIndex: 'description', key: 'description', ellipsis: true },
    ]

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <FileSpreadsheet size={20} />
                    <span>{t('glossary.keywordImport.title')}</span>
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
                            ? t('glossary.keywordImport.rowCount', { count: parsedRows.length })
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
                            {t('glossary.keywordImport.import')}
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
                            {t('glossary.keywordImport.selectFile')}
                        </span>
                        <span className="text-xs text-slate-400">
                            {t('glossary.keywordImport.fileFormat')}
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
                        {t('glossary.keywordImport.downloadTemplate')}
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
                                <p>{t('glossary.keywordImport.resultSummary', {
                                    created: importResult.created,
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
