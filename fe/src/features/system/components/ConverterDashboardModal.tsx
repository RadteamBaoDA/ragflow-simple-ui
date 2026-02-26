/**
 * @fileoverview Converter Dashboard Modal — full-screen modal for managing
 * the document conversion queue at system level.
 *
 * Shows version-level jobs with inline file expand, queue statistics,
 * schedule configuration, and manual trigger.
 *
 * @module features/system/components/ConverterDashboardModal
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Modal,
  Table,
  Tag,
  Button,
  Space,
  Card,
  Switch,
  InputNumber,
  Select,
  message,
  Tooltip,
  Progress,
  Typography,
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
} from 'lucide-react'

import {
  getConverterStats,
  getConverterJobs,
  getConverterConfig,
  updateConverterConfig,
  getVersionJobFiles,
  type VersionJob,
  type FileTrackingRecord,
  type QueueStats,
  type ConverterScheduleConfig,
  type ConversionJobStatus,
} from '../api/converterService'

const { Text } = Typography

// ============================================================================
// Types
// ============================================================================

interface ConverterDashboardModalProps {
  /** Whether the modal is visible */
  open: boolean
  /** Callback when modal is closed */
  onClose: () => void
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

/** Format ISO date string for display */
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
// FileExpandRow — inline file list for a version job
// ============================================================================

/**
 * Renders the file tracking records for a version job in an expanded row.
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
      width: 100,
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
      className="converter-file-table"
    />
  )
}

// ============================================================================
// Component
// ============================================================================

/**
 * ConverterDashboardModal — full-screen modal showing version-level jobs
 * with inline file expand, queue stats, and schedule config.
 */
const ConverterDashboardModal = ({ open, onClose }: ConverterDashboardModalProps) => {
  const { t } = useTranslation()

  // ── State ──────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [jobs, setJobs] = useState<VersionJob[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState<ConversionJobStatus | undefined>()
  const [scheduleConfig, setScheduleConfig] = useState<ConverterScheduleConfig | null>(null)
  const [savingConfig, setSavingConfig] = useState(false)
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])

  // Auto-refresh timer
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Data Fetching ──────────────────────────────────────────────────────

  /** Fetch queue stats */
  const fetchStats = useCallback(async () => {
    try {
      const s = await getConverterStats()
      setStats(s)
    } catch (err: unknown) {
      console.error('Failed to load converter stats:', err)
    }
  }, [])

  /** Fetch version jobs */
  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const result = await getConverterJobs({
        status: statusFilter,
        page,
        pageSize,
      })
      setJobs(result.jobs)
      setTotal(result.total)
    } catch (err: unknown) {
      if (!silent) {
        message.error(String(err))
      }
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page, pageSize])

  /** Fetch schedule config */
  const fetchConfig = useCallback(async () => {
    try {
      const c = await getConverterConfig()
      setScheduleConfig(c)
    } catch (err: unknown) {
      console.error('Failed to load converter config:', err)
    }
  }, [])

  /** Refresh all data */
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchStats(), fetchJobs(true), fetchConfig()])
  }, [fetchStats, fetchJobs, fetchConfig])

  // Initial load + auto-refresh
  useEffect(() => {
    if (!open) return

    refreshAll()

    // Auto-refresh every 15s
    autoRefreshRef.current = setInterval(() => {
      refreshAll()
    }, 15000)

    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    }
  }, [open, refreshAll])

  // Re-fetch jobs when filters change
  useEffect(() => {
    if (open) fetchJobs()
  }, [statusFilter, page, pageSize, open, fetchJobs])

  // ── Handlers ───────────────────────────────────────────────────────────

  /** Save schedule config */
  const handleSaveConfig = async (update: Partial<ConverterScheduleConfig>) => {
    setSavingConfig(true)
    try {
      const updated = await updateConverterConfig(update)
      setScheduleConfig(updated)
      message.success(t('converter.config.saved'))
    } catch (err: unknown) {
      message.error(String(err))
    } finally {
      setSavingConfig(false)
    }
  }

  // ── Table Columns ──────────────────────────────────────────────────────

  const columns: ColumnsType<VersionJob> = [
    {
      title: t('converter.jobs.versionId'),
      dataIndex: 'versionId',
      key: 'versionId',
      width: 120,
      ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v}>
          <Text className="text-xs font-mono">{v.slice(0, 8)}…</Text>
        </Tooltip>
      ),
    },
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
      width: 180,
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

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="90%"
      style={{ top: 20 }}
      title={
        <Space>
          <span>{t('converter.dashboard.title')}</span>
          <Button
            type="text"
            size="small"
            icon={<RefreshCw size={14} />}
            onClick={() => refreshAll()}
            loading={loading}
          />
        </Space>
      }
    >
      <div className="flex flex-col gap-6">
        {/* ── Stats Cards ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 0 }}>
          {[
            { label: t('converter.stats.pending'), value: stats?.pending ?? 0, color: '#8c8c8c', borderColor: '#d9d9d9', icon: <Clock size={18} /> },
            { label: t('converter.stats.waiting'), value: stats?.waiting ?? 0, color: '#fa8c16', borderColor: '#fa8c16', icon: <Clock size={18} /> },
            { label: t('converter.stats.converting'), value: stats?.converting ?? 0, color: '#1890ff', borderColor: '#1890ff', icon: <Loader2 size={18} /> },
            { label: t('converter.stats.finished'), value: stats?.finished ?? 0, color: '#52c41a', borderColor: '#52c41a', icon: <CheckCircle size={18} /> },
            { label: t('converter.stats.failed'), value: stats?.failed ?? 0, color: '#ff4d4f', borderColor: '#ff4d4f', icon: <XCircle size={18} /> },
            { label: t('converter.stats.total'), value: stats?.total ?? 0, color: '#1677ff', borderColor: '#1677ff', icon: null },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 8px',
                borderTop: `3px solid ${item.borderColor}`,
                borderRight: '1px solid #f0f0f0',
                background: '#fafafa',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: item.color }}>
                {item.icon}
                <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{item.value}</span>
              </div>
              <span style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* ── Schedule Config ──────────────────────────────────────────── */}
        {scheduleConfig && (
          <Card
            size="small"
            title={t('converter.config.title')}
            className="converter-schedule-card"
          >
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Text className="text-sm">{t('converter.config.enabled')}</Text>
                <Switch
                  checked={scheduleConfig.enabled}
                  loading={savingConfig}
                  onChange={(checked: boolean) => handleSaveConfig({ enabled: checked })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Text className="text-sm">{t('converter.config.startHour')}</Text>
                <InputNumber
                  min={0}
                  max={23}
                  value={scheduleConfig.startHour}
                  size="small"
                  onChange={(v: number | null) => {
                    if (v !== null) handleSaveConfig({ startHour: v })
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Text className="text-sm">{t('converter.config.endHour')}</Text>
                <InputNumber
                  min={0}
                  max={23}
                  value={scheduleConfig.endHour}
                  size="small"
                  onChange={(v: number | null) => {
                    if (v !== null) handleSaveConfig({ endHour: v })
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Text className="text-sm">{t('converter.config.timezone')}</Text>
                <Select
                  value={scheduleConfig.timezone}
                  size="small"
                  style={{ width: 200 }}
                  onChange={(v: string) => handleSaveConfig({ timezone: v })}
                  options={[
                    { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (UTC+7)' },
                    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
                    { value: 'UTC', label: 'UTC' },
                  ]}
                />
              </div>
            </div>
          </Card>
        )}

        {/* ── Status Filter ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Text className="text-sm">{t('converter.jobs.filterByStatus')}</Text>
          <Select
            allowClear
            placeholder={t('converter.jobs.allStatuses')}
            value={statusFilter}
            onChange={(v: ConversionJobStatus) => {
              setStatusFilter(v)
              setPage(1)
            }}
            size="small"
            style={{ width: 160 }}
            options={[
              { value: 'pending', label: t('converter.status.pending') },
              { value: 'waiting', label: t('converter.status.waiting') },
              { value: 'converting', label: t('converter.status.converting') },
              { value: 'finished', label: t('converter.status.finished') },
              { value: 'failed', label: t('converter.status.failed') },
            ]}
          />
        </div>

        {/* ── Version Jobs Table ────────────────────────────────────────── */}
        <Table<VersionJob>
          columns={columns}
          dataSource={jobs}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (p: number, ps: number) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
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
      </div>
    </Modal>
  )
}

export default ConverterDashboardModal
