/**
 * @fileoverview Conversion Status Modal — shows conversion jobs for a specific project.
 *
 * Opened from the project detail page. Displays a filterable table of
 * conversion jobs scoped to the project, with status badges and auto-refresh.
 *
 * @module features/projects/components/ConversionStatusModal
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Timer,
  Loader2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import {
  getConverterJobs,
  getConverterStats,
  type VersionJob,
  type QueueStats,
  type ConversionJobStatus,
} from '@/features/system/api/converterService';
import { useConverterSocket } from '@/features/system/hooks/useConverterSocket';

// ============================================================================
// Props
// ============================================================================

interface ConversionStatusModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Project ID to filter jobs */
  projectId: string;
}

// ============================================================================
// Status Badge
// ============================================================================

const StatusBadge = ({ status }: { status: ConversionJobStatus }) => {
  const map: Record<ConversionJobStatus, { color: string; icon: typeof CheckCircle2; label: string }> = {
    pending: {
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      icon: Timer,
      label: 'Pending',
    },
    waiting: {
      color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      icon: Clock,
      label: 'Waiting',
    },
    converting: {
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      icon: Loader2,
      label: 'Converting',
    },
    finished: {
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      icon: CheckCircle2,
      label: 'Finished',
    },
    failed: {
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      icon: XCircle,
      label: 'Failed',
    },
  };

  const { color, icon: Icon, label } = map[status] || map.pending;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className={`w-3 h-3 ${status === 'converting' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
};

// ============================================================================
// Mini Stats Row
// ============================================================================

const MiniStats = ({ stats }: { stats: QueueStats }) => {
  const items = [
    { label: 'Pending', value: stats.pending, color: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'Waiting', value: stats.waiting, color: 'text-orange-600 dark:text-orange-400' },
    { label: 'Converting', value: stats.converting, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Finished', value: stats.finished, color: 'text-green-600 dark:text-green-400' },
    { label: 'Failed', value: stats.failed, color: 'text-red-600 dark:text-red-400' },
  ];

  return (
    <div className="flex items-center gap-4 px-1">
      {items.map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={`text-lg font-bold ${color}`}>{value}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const ConversionStatusModal = ({ open, onClose, projectId }: ConversionStatusModalProps) => {
  const { t } = useTranslation();

  const [jobs, setJobs] = useState<VersionJob[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchData = useCallback(async (silent = false) => {
    if (isFetchingRef.current || !projectId) return;
    try {
      isFetchingRef.current = true;
      if (!silent) setLoading(true);
      setError(null);

      const [jobsData, statsData] = await Promise.all([
        getConverterJobs({ projectId, page: 1, pageSize: 100 }),
        getConverterStats(),
      ]);

      setJobs(jobsData.jobs);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      if (!silent) setLoading(false);
      isFetchingRef.current = false;
    }
  }, [projectId]);

  // Fetch on open
  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  // Auto-refresh every 15s while open (fallback)
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => fetchData(true), 15000);
    return () => clearInterval(id);
  }, [open, fetchData]);

  // Real-time updates via WebSocket — active only when modal is open
  useConverterSocket({
    enabled: open,
    onFileUpdate: () => fetchData(true),
    onJobUpdate: () => fetchData(true),
  });

  const formatTime = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('converter.projectModal.title', 'Conversion Queue')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('converter.projectModal.subtitle', 'Document conversion status for this project')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(false)}
              disabled={loading}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <MiniStats stats={stats} />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {loading && jobs.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <FileText className="w-10 h-10 mb-3 opacity-50" />
              <span className="text-sm">{t('converter.projectModal.empty', 'No conversion jobs for this project')}</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/30 text-left sticky top-0">
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Version</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Files</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {jobs.map((job: VersionJob) => (
                  <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px] font-mono text-xs" title={job.versionId}>
                          {job.versionId.slice(0, 8)}…
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {job.finishedCount + job.failedCount}/{job.fileCount}
                        {job.failedCount > 0 && <span className="text-red-500 ml-1">({job.failedCount} failed)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatTime(job.updatedAt)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversionStatusModal;
