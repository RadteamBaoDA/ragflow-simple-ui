/**
 * @fileoverview Job Management Modal — shows converter jobs for a specific
 * project version with Active/History tabs, force-start confirm dialog,
 * and optional auto-parse after upload finishes.
 *
 * @module features/projects/components/JobManagementModal
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Modal,
  Table,
  Tabs,
  Tag,
  Space,
  Button,
  Typography,
  Progress,
  Tooltip,
  Badge,
  Checkbox,
  message,
  Alert,
  type CheckboxProps,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Play,
  AlertTriangle,
} from 'lucide-react'

import {
  getConverterJobs,
  getVersionJobFiles,
  triggerManualConversion,
  parseVersionDocuments,
  type VersionJob,
  type FileTrackingRecord,
  type ConversionJobStatus,
} from '../../system/api/converterService'

const { Text } = Typography

// ============================================================================
// Types
// ============================================================================

interface JobManagementModalProps {
  /** Whether the modal is visible */
  open: boolean
  /** Close handler */
  onClose: () => void
  /** Current project ID */
  projectId: string
  /** Current category ID */
  categoryId: string
  /** Current version ID */
  versionId: string
  /** Version label for display */
  versionLabel?: string
}

// ============================================================================
// Helpers
// ============================================================================

/** Map status to Ant Design tag color */
const statusColor = (status: ConversionJobStatus): string => {
  const map: Record<string, string> = {
    pending: 'default',
    waiting: 'warning',
    converting: 'processing',
    finished: 'success',
    failed: 'error',
  }
  return map[status] || 'default'
}

/** Map status to icon */
const StatusIcon = ({ status }: { status: ConversionJobStatus }) => {
  switch (status) {
    case 'finished':
      return <CheckCircle size={14} className="text-green-500" />
    case 'failed':
      return <XCircle size={14} className="text-red-500" />
    case 'converting':
      return <Loader2 size={14} className="text-blue-500 animate-spin" />
    case 'waiting':
      return <Clock size={14} className="text-orange-400" />
    default:
      return <Clock size={14} className="text-gray-400" />
  }
}

/** Format ISO date string */
const formatDate = (iso: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================================================
// FileExpandRow
// ============================================================================

/**
 * Renders per-file tracking records for a version job.
 */
const FileExpandRow = ({ jobId }: { jobId: string }) => {
  const { t } = useTranslation()
  const [files, setFiles] = useState<FileTrackingRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getVersionJobFiles(jobId)
      .then((res) => {
        if (!cancelled) setFiles(res.files)
      })
      .catch((err: unknown) => {
        console.error('Failed to load job files:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [jobId])

  const fileColumns: ColumnsType<FileTrackingRecord> = [
    {
      title: t('converter.files.fileName'),
      dataIndex: 'fileName',
      key: 'fileName',
      ellipsis: true,
      render: (name: string) => (
        <Space size={4}>
          <FileText size={14} className="text-gray-400 shrink-0" />
          <Text className="text-xs">{name}</Text>
        </Space>
      ),
    },
    {
      title: t('converter.files.status'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: ConversionJobStatus) => (
        <Tag color={statusColor(status)} className="text-xs">
          <Space size={4}>
            <StatusIcon status={status} />
            {t(`converter.status.${status}`)}
          </Space>
        </Tag>
      ),
    },
    {
      title: t('converter.files.error'),
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (err?: string) =>
        err ? (
          <Tooltip title={err}>
            <Text type="danger" className="text-xs">{err}</Text>
          </Tooltip>
        ) : (
          <Text type="secondary" className="text-xs">—</Text>
        ),
    },
    {
      title: t('converter.files.updatedAt'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      render: (v: string) => <Text className="text-xs">{formatDate(v)}</Text>,
    },
  ]

  return (
    <Table
      columns={fileColumns}
      dataSource={files}
      rowKey="id"
      loading={loading}
      pagination={false}
      size="small"
    />
  )
}

// ============================================================================
// Component
// ============================================================================

/**
 * JobManagementModal — shows version-level jobs with Active/History tabs,
 * a Force Start button (with confirm dialog), and an optional auto-parse
 * checkbox that triggers RAGFlow parsing after all files are uploaded.
 */
const JobManagementModal = ({
  open,
  onClose,
  projectId,
  categoryId,
  versionId,
  versionLabel,
}: JobManagementModalProps) => {
  const { t } = useTranslation()
  const [jobs, setJobs] = useState<VersionJob[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])
  const [forceStarting, setForceStarting] = useState(false)
  const [parsing, setParsing] = useState(false)

  // ── Confirm dialog state ────────────────────────────────────────────────
  const [confirmVisible, setConfirmVisible] = useState(false)
  /** Whether to trigger RAGFlow parse after upload completes */
  const [autoParseAfterUpload, setAutoParseAfterUpload] = useState(false)

  // Track if we're waiting to auto-parse after job finishes
  const pendingAutoParseRef = useRef(false)
  // Stable ref so the interval can always call the latest triggerParseAll
  // without needing it as a useEffect dependency (avoids missing-dep lint)
  const triggerParseAllRef = useRef<((jobs: VersionJob[]) => Promise<void>) | null>(null)

  // ── Data Fetching ──────────────────────────────────────────────────────

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const result = await getConverterJobs({
        projectId,
        categoryId,
        versionId,
        page: 1,
        pageSize: 100,
      })
      setJobs(result.jobs)
      return result.jobs
    } catch (err: unknown) {
      console.error('Failed to fetch version jobs:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [projectId, categoryId, versionId])

  // Fetch on open + auto-refresh while modal is open
  useEffect(() => {
    if (!open) return
    fetchJobs()
    const timer = setInterval(async () => {
      const latestJobs = await fetchJobs(true)

      // ── Auto-parse trigger ─────────────────────────────────────────────
      // If user requested auto-parse and all jobs are now finished/failed
      if (pendingAutoParseRef.current && latestJobs.length > 0) {
        const allDone = latestJobs.every(
          (j) => j.status === 'finished' || j.status === 'failed',
        )
        if (allDone) {
          pendingAutoParseRef.current = false
          // Use the stable ref to avoid missing-dep warning
          triggerParseAllRef.current?.(latestJobs)
        }
      }
    }, 10000)
    return () => clearInterval(timer)
  }, [open, fetchJobs])

  // ── Parse All Finished Files ───────────────────────────────────────────

  /**
   * Collects file names from all finished jobs and triggers RAGFlow parsing.
   * @param latestJobs - Current jobs (fetched right before calling)
   */
  const triggerParseAll = useCallback(async (latestJobs: VersionJob[]) => {
    setParsing(true)
    try {
      // Gather all file names from finished jobs
      const fileNamesSet = new Set<string>()
      for (const job of latestJobs) {
        if (job.status === 'finished') {
          const res = await getVersionJobFiles(job.id)
          for (const f of res.files) {
            if (f.status === 'finished') fileNamesSet.add(f.fileName)
          }
        }
      }
      const fileNames = Array.from(fileNamesSet)
      if (fileNames.length === 0) {
        message.warning(t('converter.panel.autoParseNoFiles'))
        return
      }

      const result = await parseVersionDocuments(projectId, categoryId, versionId, fileNames)
      message.success(
        t('converter.panel.autoParseSuccess', { count: result.triggered ?? fileNames.length }),
      )
    } catch (err) {
      message.error(t('converter.panel.autoParseError'))
      console.error('Auto-parse failed:', err)
    } finally {
      setParsing(false)
    }
  }, [projectId, categoryId, versionId, t])

  // Keep the ref in sync so the interval callback always uses latest version
  useEffect(() => {
    triggerParseAllRef.current = triggerParseAll
  }, [triggerParseAll])

  // ── Force Start Handler ────────────────────────────────────────────────

  /**
   * Triggered when user clicks OK in the confirm dialog.
   * Starts conversion; if auto-parse checkbox is checked, sets the pending flag.
   */
  const handleConfirmForceStart = async () => {
    setConfirmVisible(false)
    setForceStarting(true)
    try {
      const result = await triggerManualConversion()
      message.success(result.message || t('converter.panel.forceStartSuccess'))

      // If user checked "parse after finish", set the pending flag.
      // The refresh interval will detect when all jobs are done and call triggerParseAll.
      if (autoParseAfterUpload) {
        pendingAutoParseRef.current = true
        message.info(t('converter.panel.autoParseScheduled'))
      }

      // Refresh after a short delay to show new status
      setTimeout(() => fetchJobs(), 1500)
    } catch (err) {
      message.error(t('converter.panel.forceStartError'))
    } finally {
      setForceStarting(false)
    }
  }

  // ── Split jobs into active and history ─────────────────────────────────

  const activeJobs = jobs.filter(
    (j) => j.status === 'pending' || j.status === 'waiting' || j.status === 'converting',
  )
  const historyJobs = jobs.filter(
    (j) => j.status === 'finished' || j.status === 'failed',
  )

  // Force Start: enabled only when ≥1 pending job and no waiting/converting
  const hasPending = jobs.some((j) => j.status === 'pending')
  const hasActive = jobs.some((j) => j.status === 'waiting' || j.status === 'converting')
  const forceStartDisabled = !hasPending || hasActive

  // ── Table Columns ──────────────────────────────────────────────────────

  const columns: ColumnsType<VersionJob> = [
    {
      title: t('converter.jobs.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: ConversionJobStatus) => (
        <Tag color={statusColor(status)}>
          <Space size={4}>
            <StatusIcon status={status} />
            {t(`converter.status.${status}`)}
          </Space>
        </Tag>
      ),
    },
    {
      title: t('converter.jobs.files'),
      key: 'fileProgress',
      width: 200,
      render: (_: unknown, record: VersionJob) => {
        const { fileCount, finishedCount, failedCount } = record
        const doneCount = finishedCount + failedCount
        const percent = fileCount > 0 ? Math.round((doneCount / fileCount) * 100) : 0
        return (
          <div className="flex flex-col gap-0.5">
            <Progress
              percent={percent}
              size="small"
              status={failedCount > 0 ? 'exception' : undefined}
              format={() => `${doneCount}/${fileCount}`}
            />
            <Text type="secondary" className="text-xs">
              {finishedCount > 0 && <span className="text-green-600">{finishedCount} ✓</span>}
              {failedCount > 0 && <span className="text-red-500 ml-1">{failedCount} ✗</span>}
            </Text>
          </div>
        )
      },
    },
    {
      title: t('converter.jobs.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (v: string) => <Text className="text-xs">{formatDate(v)}</Text>,
    },
    {
      title: t('converter.jobs.updatedAt'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      render: (v: string) => <Text className="text-xs">{formatDate(v)}</Text>,
    },
  ]

  // ── Shared table render ────────────────────────────────────────────────

  const renderJobTable = (data: VersionJob[]) => (
    <Table<VersionJob>
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      size="small"
      pagination={data.length > 10 ? { pageSize: 10, size: 'small', showSizeChanger: false } : false}
      expandable={{
        expandedRowKeys,
        onExpand: (expanded: boolean, record: VersionJob) => {
          setExpandedRowKeys(expanded ? [record.id] : [])
        },
        expandedRowRender: (record: VersionJob) => <FileExpandRow jobId={record.id} />,
        expandIcon: ({ expanded, onExpand, record }: { expanded: boolean; onExpand: (record: VersionJob, e: React.MouseEvent<HTMLElement>) => void; record: VersionJob }) => (
          <Button
            type="text"
            size="small"
            icon={expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            onClick={(e: React.MouseEvent<HTMLElement>) => onExpand(record, e)}
          />
        ),
      }}
    />
  )

  // ── Tab items ──────────────────────────────────────────────────────────

  const tabItems = [
    {
      key: 'active',
      label: (
        <Space size={4}>
          {t('converter.panel.activeJobs')}
          {activeJobs.length > 0 && <Badge count={activeJobs.length} size="small" />}
        </Space>
      ),
      children: renderJobTable(activeJobs),
    },
    {
      key: 'history',
      label: t('converter.panel.jobHistory'),
      children: renderJobTable(historyJobs),
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Main modal ─────────────────────────────────────────────────── */}
      <Modal
        open={open}
        onCancel={onClose}
        title={
          <div className="flex items-center justify-between pr-8">
            <Text strong>
              {t('converter.panel.title')}
              {versionLabel && (
                <Text type="secondary" className="ml-2 text-sm font-normal">
                  — {versionLabel}
                </Text>
              )}
            </Text>
          </div>
        }
        width="70%"
        footer={null}
        destroyOnClose
      >
        {/* Action bar */}
        <div className="flex items-center justify-between mb-3">
          <Space>
            <Button
              type="primary"
              icon={<Play size={14} />}
              onClick={() => setConfirmVisible(true)}
              loading={forceStarting || parsing}
              disabled={forceStartDisabled}
              size="small"
            >
              {parsing
                ? t('converter.panel.parsing')
                : t('converter.panel.forceStart')}
            </Button>
            {pendingAutoParseRef.current && (
              <Text type="secondary" className="text-xs">
                {t('converter.panel.waitingToAutoparse')}
              </Text>
            )}
          </Space>
          <Button
            type="text"
            size="small"
            icon={<RefreshCw size={14} />}
            onClick={() => fetchJobs()}
            loading={loading}
          />
        </div>

        <Tabs items={tabItems} defaultActiveKey="active" size="small" />
      </Modal>

      {/* ── Confirm dialog ─────────────────────────────────────────────── */}
      <Modal
        open={confirmVisible}
        onCancel={() => setConfirmVisible(false)}
        onOk={handleConfirmForceStart}
        okText={t('converter.panel.forceStart')}
        okType="primary"
        cancelText={t('common.cancel', 'Cancel')}
        title={
          <Space>
            <AlertTriangle size={16} className="text-orange-500" />
            {t('converter.panel.forceStartConfirmTitle')}
          </Space>
        }
        width={480}
      >
        <div className="flex flex-col gap-3 py-1">
          <Alert
            type="warning"
            showIcon={false}
            message={t('converter.panel.forceStartConfirmMessage')}
          />

          {/* Auto-parse checkbox */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <Checkbox
              checked={autoParseAfterUpload}
              onChange={((e) => setAutoParseAfterUpload(e.target.checked)) as CheckboxProps['onChange']}
            >
              <div>
                <div className="font-medium text-sm">
                  {t('converter.panel.autoParseLabel')}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {t('converter.panel.autoParseDesc')}
                </div>
              </div>
            </Checkbox>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default JobManagementModal
