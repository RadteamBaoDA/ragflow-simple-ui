/**
 * @fileoverview Modal dialog for uploading files via drag-and-drop.
 *
 * Shows an antd Upload.Dragger inside a modal with per-file progress tracking.
 *
 * @module features/projects/components/UploadFilesModal
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Upload, message, Progress, List, Tag } from 'antd'
import { UploadCloud, CheckCircle, XCircle, Loader } from 'lucide-react'
import { uploadVersionDocument } from '../api/projectService'

// ============================================================================
// Constants
// ============================================================================

/** Accepted MIME types for the Upload component */
const ACCEPTED_MIME =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,' +
  'application/pdf,' +
  'application/msword,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'application/vnd.ms-powerpoint,' +
  'application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
  'text/plain,' +
  'text/markdown,' +
  'text/csv'

// ============================================================================
// Types
// ============================================================================

interface UploadFilesModalProps {
  /** Whether the modal is visible */
  open: boolean
  /** Project ID */
  projectId: string
  /** Category ID */
  categoryId: string
  /** Version ID to upload documents to */
  versionId: string
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback after uploads complete to refresh document list */
  onUploadComplete?: () => void
}

/** Per-file upload tracking */
interface FileUploadItem {
  key: string
  name: string
  size: number
  status: 'pending' | 'uploading' | 'success' | 'failed'
  error?: string
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format bytes into a human-readable size string.
 * @param bytes - File size in bytes
 * @returns Formatted size string
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

// ============================================================================
// Component
// ============================================================================

/**
 * Modal with drag-and-drop file upload and per-file progress tracking.
 *
 * @param {UploadFilesModalProps} props - Component props
 * @returns {JSX.Element} The rendered modal
 */
const UploadFilesModal = ({
  open,
  projectId,
  categoryId,
  versionId,
  onClose,
  onUploadComplete,
}: UploadFilesModalProps) => {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<FileUploadItem[]>([])

  /**
   * Upload files sequentially with per-file tracking.
   * @param files - Array of File objects to upload
   */
  const handleUploadFiles = async (files: File[]) => {
    if (files.length === 0) return
    setUploading(true)

    // Build tracking items
    const items: FileUploadItem[] = files.map((f, i) => ({
      key: `${Date.now()}-${i}`,
      name: f.name,
      size: f.size,
      status: 'pending' as const,
    }))
    setFileList(items)

    let succeeded = 0
    let failed = 0

    // Upload one at a time
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      const item = items[i]!
      item.status = 'uploading'
      setFileList([...items])

      try {
        await uploadVersionDocument(projectId, categoryId, versionId, file)
        item.status = 'success'
        succeeded++
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err)
        item.status = 'failed'
        item.error = String(err)
        failed++
      }
      setFileList([...items])
    }

    // Show summary
    if (failed === 0) {
      message.success(t('projectManagement.documents.uploadSuccess'))
    } else {
      message.warning(
        `${succeeded}/${files.length} ${t('projectManagement.documents.uploadSuccess')}. ${failed} ${t('projectManagement.documents.uploadError')}`
      )
    }

    setUploading(false)
    onUploadComplete?.()
    // Clear progress after a short delay
    setTimeout(() => setFileList([]), 3000)
  }

  /** Handle modal close — only allow if not uploading */
  const handleClose = () => {
    if (uploading) return
    setFileList([])
    onClose()
  }

  // Progress stats
  const completedCount = fileList.filter((f) => f.status === 'success' || f.status === 'failed').length
  const overallPercent = fileList.length > 0 ? Math.round((completedCount / fileList.length) * 100) : 0
  const failedCount = fileList.filter((f) => f.status === 'failed').length

  return (
    <Modal
      title={t('projectManagement.documents.uploadFiles')}
      open={open}
      onCancel={handleClose}
      footer={null}
      destroyOnHidden
      width={560}
      maskClosable={!uploading}
    >
      {/* Drag-and-drop area */}
      <Upload.Dragger
        accept={ACCEPTED_MIME}
        multiple
        showUploadList={false}
        disabled={uploading}
        beforeUpload={(_file: File, uploadFileList: File[]) => {
          // Ant Design calls beforeUpload once per file — only trigger on the first to avoid N×N uploads
          if (_file === uploadFileList[0]) {
            handleUploadFiles(uploadFileList as unknown as File[])
          }
          return false
        }}
        className="!border-dashed !border-gray-300 dark:!border-gray-600"
        style={{ padding: '24px 16px' }}
      >
        <div className="flex flex-col items-center gap-2">
          <UploadCloud size={36} className="text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400 m-0">
            {t('projectManagement.documents.uploadHint')}
          </p>
          <p className="text-xs text-gray-400 m-0">
            {t('projectManagement.documents.acceptedTypes')}
          </p>
        </div>
      </Upload.Dragger>

      {/* Per-file upload progress */}
      {fileList.length > 0 && (
        <div className="mt-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          {/* Overall progress */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('projectManagement.documents.uploading')} {completedCount}/{fileList.length}
            </span>
            <Progress
              percent={overallPercent}
              size="small"
              status={failedCount > 0 ? 'exception' : uploading ? 'active' : 'success'}
              style={{ width: 120, margin: 0 }}
            />
          </div>

          {/* Individual file list */}
          <List
            size="small"
            dataSource={fileList}
            renderItem={(item) => (
              <List.Item className="!py-1 !px-0 !border-b-0">
                <div className="flex items-center justify-between w-full gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {item.status === 'success' && <CheckCircle size={14} className="text-green-500 shrink-0" />}
                    {item.status === 'failed' && <XCircle size={14} className="text-red-500 shrink-0" />}
                    {item.status === 'uploading' && <Loader size={14} className="text-blue-500 animate-spin shrink-0" />}
                    {item.status === 'pending' && <div className="w-[14px] h-[14px] rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />}
                    <span className="text-xs truncate text-gray-700 dark:text-gray-300">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400">{formatFileSize(item.size)}</span>
                    {item.status === 'uploading' && <Tag color="processing" className="text-xs m-0">{t('projectManagement.documents.uploading')}</Tag>}
                    {item.status === 'failed' && <Tag color="error" className="text-xs m-0">{t('projectManagement.documents.uploadError')}</Tag>}
                  </div>
                </div>
              </List.Item>
            )}
            style={{ maxHeight: 200, overflow: 'auto' }}
          />
        </div>
      )}
    </Modal>
  )
}

export default UploadFilesModal
