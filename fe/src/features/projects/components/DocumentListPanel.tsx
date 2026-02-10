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
import { Table, Tag, Empty, Input, Button, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileText, FileSpreadsheet, FileImage, File, UploadCloud, FolderUp } from 'lucide-react'
import { getVersionDocuments, type VersionDocument } from '../api/projectService'
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
  /** Trigger counter — increment to force a refresh (e.g. after upload) */
  refreshKey?: number
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
const DocumentListPanel = ({ projectId, categoryId, versionId, refreshKey }: DocumentListPanelProps) => {
  const { t } = useTranslation()
  const [documents, setDocuments] = useState<VersionDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')

  // Upload modal state
  const [uploadFilesOpen, setUploadFilesOpen] = useState(false)
  const [uploadFolderOpen, setUploadFolderOpen] = useState(false)

  /** Counter to trigger refresh after upload */
  const [localRefreshKey, setLocalRefreshKey] = useState(0)

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

  /** Callback after upload completes */
  const handleUploadComplete = () => {
    setLocalRefreshKey((k) => k + 1)
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
      width: 120,
      render: (run: string, record: VersionDocument) => {
        const statusMap: Record<string, { color: string; label: string }> = {
          UNSTART: { color: 'default', label: t('projectManagement.documents.statusPending') },
          RUNNING: { color: 'processing', label: t('projectManagement.documents.statusParsing') },
          CANCEL: { color: 'warning', label: t('projectManagement.documents.statusCancelled') },
          DONE: { color: 'success', label: t('projectManagement.documents.statusParsed') },
          FAIL: { color: 'error', label: t('projectManagement.documents.statusFailed') },
        }
        const info = statusMap[run] || { color: 'default', label: run }
        return (
          <Tag color={info.color}>
            {info.label}
            {run === 'RUNNING' && record.progress > 0 && ` ${Math.round(record.progress * 100)}%`}
          </Tag>
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
          {!loading && documents.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({documents.length} {t('projectManagement.documents.totalFiles')})
            </span>
          )}
        </h4>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Document table */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={documents}
        size="small"
        loading={loading}
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
