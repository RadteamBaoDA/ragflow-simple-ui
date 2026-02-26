/**
 * @fileoverview Job Management Panel — shows converter jobs for a specific
 * project version, with inline file tracking expand.
 *
 * Displayed within the DocumentsTab when a category version is selected.
 * Fetches version-level jobs filtered by versionId and shows file progress.
 *
 * @module features/projects/components/JobManagementPanel
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Collapse,
  Table,
  Tag,
  Space,
  Button,
  Typography,
  Progress,
  Tooltip,
  Badge,
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
  Layers,
} from 'lucide-react'

import {
  getConverterJobs,
  getVersionJobFiles,
  type VersionJob,
  type FileTrackingRecord,
  type ConversionJobStatus,
} from '../../system/api/converterService'
import { useConverterSocket } from '../../system/hooks/useConverterSocket'

const { Text } = Typography

// ============================================================================
// Types
// ============================================================================

interface JobManagementPanelProps {
  /** Current project ID */
  projectId: string
  /** Current category ID */
  categoryId: string
  /** Current version ID */
  versionId: string
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
 * JobManagementPanel — shows version-level jobs for a specific version
 * with inline file tracking expand.
 */
const JobManagementPanel = ({
  projectId,
  categoryId,
  versionId,
}: JobManagementPanelProps) => {
  const { t } = useTranslation()
  const [jobs, setJobs] = useState<VersionJob[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])

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
    } catch (err: unknown) {
      console.error('Failed to fetch version jobs:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId, categoryId, versionId])

  // Initial fetch + auto-refresh every 30s (fallback)
  useEffect(() => {
    fetchJobs()
    const timer = setInterval(() => fetchJobs(true), 30000)
    return () => clearInterval(timer)
  }, [fetchJobs])

  // Real-time updates via WebSocket — triggers silent refetch
  useConverterSocket({
    onFileUpdate: () => fetchJobs(true),
    onJobUpdate: () => fetchJobs(true),
  })

  // ── Panel Header ───────────────────────────────────────────────────────

  /** Count active (pending/processing) jobs */
  const activeCount = jobs.filter(
    (j) => j.status === 'pending' || j.status === 'waiting' || j.status === 'converting',
  ).length

  const panelHeader = (
    <div className="flex items-center justify-between w-full pr-2">
      <Space>
        <Layers size={16} className="text-gray-500" />
        <Text strong className="text-sm">
          {t('converter.panel.title')}
        </Text>
        {activeCount > 0 && (
          <Badge count={activeCount} size="small" />
        )}
      </Space>
      <Button
        type="text"
        size="small"
        icon={<RefreshCw size={14} />}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation()
          fetchJobs()
        }}
        loading={loading}
      />
    </div>
  )

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

  // ── Render ─────────────────────────────────────────────────────────────

  if (jobs.length === 0 && !loading) return null

  return (
    <Collapse
      ghost
      defaultActiveKey={['jobs']}
      className="converter-job-panel"
      items={[
        {
          key: 'jobs',
          label: panelHeader,
          children: (
            <Table<VersionJob>
              columns={columns}
              dataSource={jobs}
              rowKey="id"
              loading={loading}
              size="small"
              pagination={false}
              expandable={{
                expandedRowKeys,
                onExpand: (expanded: boolean, record: VersionJob) => {
                  setExpandedRowKeys(expanded ? [record.id] : [])
                },
                expandedRowRender: (record: VersionJob) => <FileExpandRow jobId={record.id} />,
                expandIcon: ({ expanded, onExpand, record }: { expanded: boolean; onExpand: (record: VersionJob, e: React.MouseEvent) => void; record: VersionJob }) => (
                  <Button
                    type="text"
                    size="small"
                    icon={expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    onClick={(e: React.MouseEvent) => onExpand(record, e)}
                  />
                ),
              }}
            />
          ),
        },
      ]}
    />
  )
}

export default JobManagementPanel
