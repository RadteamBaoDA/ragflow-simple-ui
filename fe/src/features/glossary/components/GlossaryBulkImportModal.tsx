/**
 * @fileoverview Glossary Bulk Import Modal
 *
 * Parses Excel files with columns:
 *   task_name, task_instruction, context_template, keyword, keyword_description
 * Previews data in a table, then sends to the bulk-import API.
 */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'
import {
    Modal, Button, Table, Alert, Progress, Space
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

    // ========================================================================
    // File Parsing
    // ========================================================================

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

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

                // Validate required columns
                if (jsonData.length === 0) {
                    setParseError(t('glossary.bulkImport.emptyFile'))
                    return
                }

                const firstRow = jsonData[0]!
                const requiredCols = ['task_name', 'task_instruction', 'context_template', 'keyword']
                const missingCols = requiredCols.filter((col) => !(col in firstRow))
                if (missingCols.length > 0) {
                    setParseError(t('glossary.bulkImport.missingColumns', { cols: missingCols.join(', ') }))
                    return
                }

                // Map to BulkImportRow
                const rows: BulkImportRow[] = jsonData
                    .filter((row) => row.task_name && row.keyword)
                    .map((row) => ({
                        task_name: row.task_name?.trim() || '',
                        task_instruction: row.task_instruction?.trim() || '',
                        context_template: row.context_template?.trim() || '',
                        keyword: row.keyword?.trim() || '',
                        keyword_description: row.keyword_description?.trim() || undefined,
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

        // Reset input so the same file can be re-selected
        e.target.value = ''
    }, [t])

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
        { title: t('glossary.bulkImport.colTaskInstruction'), dataIndex: 'task_instruction', key: 'task_instruction', ellipsis: true },
        { title: t('glossary.bulkImport.colContextTemplate'), dataIndex: 'context_template', key: 'context_template', ellipsis: true },
        { title: t('glossary.bulkImport.colKeyword'), dataIndex: 'keyword', key: 'keyword', width: 150 },
        { title: t('glossary.bulkImport.colKeywordDesc'), dataIndex: 'keyword_description', key: 'keyword_description', ellipsis: true },
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
                {/* File Upload Area */}
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center">
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
                                    keywords: importResult.keywordsCreated,
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

                {/* Importing Progress */}
                {importing && (
                    <Progress percent={100} status="active" strokeColor={{ from: '#108ee9', to: '#87d068' }} />
                )}
            </div>
        </Modal>
    )
}
