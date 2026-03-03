/**
 * @fileoverview Document list panel for a selected version.
 *
 * Fetches and displays documents from the RAGFlow dataset associated
 * with the selected version. Shows file name, size, type, and parsing status.
 * Includes upload buttons that open file/folder upload modals.
 *
 * @module features/projects/components/DocumentListPanel
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Table, Tag, Empty, Input, Button, Tooltip, Popconfirm, message, Badge } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileText, FileSpreadsheet, FileImage, File, UploadCloud, FolderUp, Trash2, Layers, RefreshCw, Play } from 'lucide-react'
import { getVersionDocuments, deleteVersionDocuments, requeueVersionDocuments, parseVersionDocuments, syncVersionParserStatus, type VersionDocument } from '../api/projectService'

import { useConverterSocket } from '../../system/hooks/useConverterSocket'
import UploadFilesModal from './UploadFilesModal'
import UploadFolderModal from './UploadFolderModal'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format bytes into a human-readable size string.
 * @param bytes - File size in bytes
 * @returns Formatted size string (e.g. "1.5 MB")
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/**
 * Get a file type icon based on file extension.
 * @param name - File name
 * @returns Lucide icon component
 */
const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) return <FileText size={14} className="text-blue-500" />
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={14} className="text-green-500" />
  if (['ppt', 'pptx'].includes(ext)) return <FileImage size={14} className="text-orange-500" />
  return <File size={14} className="text-gray-400" />
}


// ============================================================================
// Types
// ============================================================================

interface DocumentListPanelProps {
  /** Project ID */
  projectId: string
  /** Category ID */
  categoryId: string
  /** Selected version ID */
  versionId: string
  /** Display label for the selected version */
  versionLabel?: string
  /** Trigger counter — increment to force a refresh (e.g. after upload) */
  refreshKey?: number
  /** Callback to open the jobs modal */
  onShowJobs?: () => void
  /** Number of active jobs for badge display */
  activeJobCount?: number
}

// ============================================================================
// Component
// ============================================================================

/**
 * Panel showing documents for a selected version with search, upload buttons, and pagination.
 *
 * @param {DocumentListPanelProps} props - Component props
 * @returns {JSX.Element} The rendered document list panel
 */
const DocumentListPanel = ({ projectId, categoryId, versionId, versionLabel, refreshKey, onShowJobs, activeJobCount }: DocumentListPanelProps) => {
  const { t } = useTranslation()
  const [documents, setDocuments] = useState<VersionDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')

  // Upload modal state
  const [uploadFilesOpen, setUploadFilesOpen] = useState(false)
  const [uploadFolderOpen, setUploadFolderOpen] = useState(false)

  /** Counter to trigger refresh after upload */
  const [localRefreshKey, setLocalRefreshKey] = useState(0)

  /** Selected row keys for multi-delete */
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  /** Loading state for delete operation */
  const [deleting, setDeleting] = useState(false)
  /** Loading state for requeue operation */
  const [requeueing, setRequeueing] = useState(false)
  /** Loading state for parse operation */
  const [parsing, setParsing] = useState(false)
  /** Loading state for parser status sync operation */
  const [syncing, setSyncing] = useState(false)

  /** Fetch documents for the selected version */
  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const docs = await getVersionDocuments(projectId, categoryId, versionId, {
        page: 1,
        page_size: 100,
        ...(searchKeyword ? { keywords: searchKeyword } : {}),
      })
      setDocuments(docs || [])
    } catch (err) {
      console.error('Failed to load documents:', err)
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [projectId, categoryId, versionId, searchKeyword])

  // Fetch on mount, version change, or refresh trigger
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments, refreshKey, localRefreshKey])

  // Real-time updates via WebSocket — refresh documents to pick up status changes
  useConverterSocket({
    onFileUpdate: () => fetchDocuments(),
    onJobUpdate: () => fetchDocuments(),
  })

  // Polling fallback — auto-refresh every 5s while documents are in-progress
  // This ensures status updates even if WebSocket is not connected
  useEffect(() => {
    const hasInProgress = documents.some(
      (doc) => doc.run === 'local' || doc.run === 'converted',
    )
    if (!hasInProgress || documents.length === 0) return

    const interval = setInterval(() => {
      fetchDocuments()
    }, 5000)

    return () => clearInterval(interval)
  }, [documents, fetchDocuments])

  /** Callback after upload completes */
  const handleUploadComplete = () => {
    setLocalRefreshKey((k) => k + 1)
  }

  /** Delete selected documents */
  const handleDeleteSelected = async () => {
    if (selectedRowKeys.length === 0) return
    setDeleting(true)
    try {
      const result = await deleteVersionDocuments(projectId, categoryId, versionId, selectedRowKeys)
      const deletedCount = result.deleted?.length ?? selectedRowKeys.length
      message.success(t('projectManagement.documents.deleteSuccess', { count: deletedCount }))
      setSelectedRowKeys([])
      setLocalRefreshKey((k) => k + 1)
    } catch (err) {
      message.error(t('projectManagement.documents.deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  /** Re-queue selected local files for conversion */
  const handleRetryParse = async () => {
    if (selectedRowKeys.length === 0) return
    setRequeueing(true)
    try {
      const result = await requeueVersionDocuments(projectId, categoryId, versionId, selectedRowKeys)
      const queuedCount = result.queued?.length ?? 0
      message.success(t('projectManagement.documents.retryParseSuccess', { count: queuedCount }))
      setSelectedRowKeys([])
      setLocalRefreshKey((k) => k + 1)
    } catch (err) {
      message.error(String(err))
    } finally {
      setRequeueing(false)
    }
  }

  /** Start parsing selected imported documents in RAGFlow */
  const handleStartParse = async () => {
    if (selectedRowKeys.length === 0) return
    setParsing(true)
    try {
      const result = await parseVersionDocuments(projectId, categoryId, versionId, selectedRowKeys)
      const parsedCount = result.parsed?.length ?? 0
      message.success(t('projectManagement.documents.startParseSuccess', { count: parsedCount }))
      setSelectedRowKeys([])
      setLocalRefreshKey((k) => k + 1)
    } catch (err) {
      message.error(String(err))
    } finally {
      setParsing(false)
    }
  }

  /** Check if any selected files are local-only (eligible for retry) */
  const hasLocalSelected = selectedRowKeys.length > 0 && documents.some(
    (doc) => selectedRowKeys.includes(doc.id) && doc.run === 'local',
  )

  /** Check if any selected files are imported (eligible for parsing) */
  const hasImportedSelected = selectedRowKeys.length > 0 && documents.some(
    (doc) => selectedRowKeys.includes(doc.id) && doc.run === 'imported',
  )

  /**
   * Check if any doc in the list is in a parse-trackable state.
   * Shows the Sync Parser Status button when relevant.
   */
  const hasParseableStatus = documents.some(
    (doc) => doc.run === 'imported' || doc.run === 'UNSTART' || doc.run === 'RUNNING',
  )

  /** Sync live parser status from RAGFlow on demand */
  const handleSyncParserStatus = async () => {
    setSyncing(true)
    try {
      await syncVersionParserStatus(projectId, categoryId, versionId)
      // Refresh the local document list to pick up updated statuses
      await fetchDocuments()
      message.success(t('projectManagement.documents.syncParserSuccess'))
    } catch (err) {
      message.error(t('projectManagement.documents.syncParserError'))
    } finally {
      setSyncing(false)
    }
  }

  // ── Table columns ──────────────────────────────────────────────────────

  const columns: ColumnsType<VersionDocument> = [
    {
      title: t('projectManagement.documents.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string) => (
        <div className="flex items-center gap-2">
          {getFileIcon(name)}
          <span className="truncate" title={name}>{name}</span>
        </div>
      ),
    },
    {
      title: t('projectManagement.documents.size'),
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => <span className="text-gray-500 text-xs">{formatFileSize(size)}</span>,
    },
    {
      title: t('projectManagement.documents.status'),
      dataIndex: 'run',
      key: 'run',
      width: 140,
      render: (run: string, record: VersionDocument) => {
        // Document pipeline status map
        const statusMap: Record<string, { color: string; label: string }> = {
          // Local pipeline statuses (from BE converter tracking)
          local: { color: 'default', label: t('projectManagement.documents.statusLocal') },
          converted: { color: 'cyan', label: t('projectManagement.documents.statusConverted') },
          imported: { color: 'blue', label: t('projectManagement.documents.statusImported') },
          failed: { color: 'error', label: t('projectManagement.documents.statusFailed') },
          // RAGFlow parsing statuses
          UNSTART: { color: 'default', label: t('projectManagement.documents.statusPending') },
          RUNNING: { color: 'processing', label: t('projectManagement.documents.statusParsing') },
          CANCEL: { color: 'warning', label: t('projectManagement.documents.statusCancelled') },
          DONE: { color: 'success', label: t('projectManagement.documents.statusParsed') },
          FAIL: { color: 'error', label: t('projectManagement.documents.statusFailed') },
        }
        const info = statusMap[run] || { color: 'default', label: run }
        return (
          <Tooltip title={record.progress_msg || undefined}>
            <Tag color={info.color}>
              {info.label}
              {run === 'RUNNING' && record.progress > 0 && ` ${Math.round(record.progress * 100)}%`}
            </Tag>
          </Tooltip>
        )
      },
    },
    {
      title: t('projectManagement.documents.chunks'),
      dataIndex: 'chunk_count',
      key: 'chunk_count',
      width: 80,
      render: (count: number) => <span className="text-gray-500 text-xs">{count ?? '-'}</span>,
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="mt-4">
      {/* Header: title + actions */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t('projectManagement.documents.title')}
          {versionLabel && (
            <Tag color="blue" style={{ marginLeft: 8, fontSize: 12 }}>{versionLabel}</Tag>
          )}
          {!loading && documents.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({documents.length} {t('projectManagement.documents.totalFiles')})
            </span>
          )}
        </h4>
        <div className="flex items-center gap-2">
          {selectedRowKeys.length > 0 && (
            <>
              <Popconfirm
                title={t('projectManagement.documents.deleteConfirm', { count: selectedRowKeys.length })}
                description={hasImportedSelected ? t('projectManagement.documents.deleteConfirmRagflow') : undefined}
                onConfirm={handleDeleteSelected}
                okButtonProps={{ danger: true, loading: deleting }}
              >
                <Button
                  danger
                  size="small"
                  icon={<Trash2 size={14} />}
                  loading={deleting}
                >
                  {t('projectManagement.documents.deleteSelected', { count: selectedRowKeys.length })}
                </Button>
              </Popconfirm>
              {hasLocalSelected && (
                <Button
                  type="primary"
                  size="small"
                  icon={<RefreshCw size={14} />}
                  loading={requeueing}
                  onClick={handleRetryParse}
                >
                  {t('projectManagement.documents.retryParse')}
                </Button>
              )}
              {hasImportedSelected && (
                <Button
                  type="primary"
                  size="small"
                  icon={<Play size={14} />}
                  loading={parsing}
                  onClick={handleStartParse}
                >
                  {t('projectManagement.documents.startParse')}
                </Button>
              )}
            </>
          )}
          <Input.Search
            placeholder={t('projectManagement.documents.search')}
            size="small"
            style={{ width: 200 }}
            allowClear
            onSearch={(value: string) => setSearchKeyword(value)}
          />
          <Tooltip title={t('projectManagement.documents.uploadFiles')}>
            <Button
              type="primary"
              size="small"
              icon={<UploadCloud size={14} />}
              onClick={() => setUploadFilesOpen(true)}
            >
              {t('projectManagement.documents.uploadFiles')}
            </Button>
          </Tooltip>
          <Tooltip title={t('projectManagement.documents.folderUpload')}>
            <Button
              type="primary"
              size="small"
              icon={<FolderUp size={14} />}
              onClick={() => setUploadFolderOpen(true)}
            >
              {t('projectManagement.documents.folderUpload')}
            </Button>
          </Tooltip>
          {onShowJobs && (
            <Tooltip title={t('converter.panel.title')}>
              <Badge count={activeJobCount || 0} size="small" offset={[-2, 2]}>
                <Button
                  size="small"
                  icon={<Layers size={14} />}
                  onClick={onShowJobs}
                >
                  {t('converter.panel.title')}
                </Button>
              </Badge>
            </Tooltip>
          )}
          {hasParseableStatus && (
            <Tooltip title={t('projectManagement.documents.syncParserStatus')}>
              <Button
                size="small"
                icon={<RefreshCw size={14} />}
                loading={syncing}
                onClick={handleSyncParserStatus}
              >
                {t('projectManagement.documents.syncParserStatus')}
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Document table */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={documents}
        size="small"
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
        }}
        pagination={documents.length > 20 ? { pageSize: 20, size: 'small', showSizeChanger: false } : false}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('projectManagement.documents.noDocumentsHint')}
            />
          ),
        }}
      />

      {/* Upload modals */}
      <UploadFilesModal
        open={uploadFilesOpen}
        projectId={projectId}
        categoryId={categoryId}
        versionId={versionId}
        onClose={() => setUploadFilesOpen(false)}
        onUploadComplete={handleUploadComplete}
      />
      <UploadFolderModal
        open={uploadFolderOpen}
        projectId={projectId}
        categoryId={categoryId}
        versionId={versionId}
        onClose={() => setUploadFolderOpen(false)}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  )
}

export default DocumentListPanel

