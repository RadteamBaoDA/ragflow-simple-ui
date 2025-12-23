/**
 * @fileoverview System Monitor Page
 * 
 * Displays real-time health and performance metrics of the system.
 * Accessible only to administrators.
 * 
 * Features:
 * - Service Health Status (DB, Redis, MinIO, Langfuse)
 * - System Metrics (Uptime, Memory, CPU)
 * - Auto-refresh with configurable interval
 * - Concurrency control for health checks
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Activity,
    Server,
    Database,
    HardDrive,
    Cpu,
    Clock,
    RefreshCw,
    Zap,
    Box,
    AlertCircle,
    CheckCircle2,
    XCircle,
    HelpCircle
} from 'lucide-react';
import { getSystemHealth, SystemHealth } from '../services/systemToolsService';

// ============================================================================
// Types & Constants
// ============================================================================

/** Refresh interval options in milliseconds */
const REFRESH_INTERVALS = [
    { label: '30s', value: 30000 },
    { label: '1m', value: 60000 },
    { label: '5m', value: 300000 },
    { label: '10m', value: 600000 },
];

/** Default refresh interval */
const DEFAULT_INTERVAL = 30000;

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Status indicator badge component.
 */
const StatusBadge = ({ status }: { status: string }) => {
    const { t } = useTranslation();

    // Determine color and icon based on status
    let color = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    let Icon = HelpCircle;
    let label = status;

    switch (status) {
        case 'connected':
        case 'ok':
        case 'running':
        case 'enabled':
            color = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            Icon = CheckCircle2;
            label = t('systemMonitor.status.healthy');
            break;
        case 'disconnected':
        case 'error':
        case 'failed':
        case 'disabled':
            color = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            Icon = XCircle;
            label = status === 'disabled' ? t('systemMonitor.status.disabled') : t('systemMonitor.status.error');
            break;
        case 'connecting':
        case 'loading':
            color = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
            Icon = Activity;
            label = t('systemMonitor.status.connecting');
            break;
        case 'not_initialized':
        case 'not_configured':
            color = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
            Icon = AlertCircle;
            label = t('systemMonitor.status.notConfigured');
            break;
    }

    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
        </div>
    );
};

/**
 * Card for displaying a service health.
 */
const ServiceCard = ({
    title,
    icon: Icon,
    status,
    enabled,
    subtext
}: {
    title: string;
    icon: any;
    status: string;
    enabled: boolean;
    subtext?: string
}) => {
    const { t } = useTranslation();

    return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex items-start justify-between">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                    <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
                    <div className="mt-1 flex items-center gap-2">
                        <StatusBadge status={status} />
                        {enabled ? (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-500 border border-green-100 dark:border-green-800/30" title="Enabled">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{t('common.on')}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700" title="Disabled">
                                <XCircle className="w-3 h-3" />
                                <span>{t('common.off')}</span>
                            </div>
                        )}
                    </div>
                    {subtext && (
                        <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 font-mono break-all leading-tight">
                            {subtext}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Card for displaying a resource metric.
 */
const MetricCard = ({
    title,
    value,
    subValue,
    icon: Icon,
    colorClass = "text-primary-600 dark:text-primary-400"
}: {
    title: string;
    value: string | number;
    subValue?: string;
    icon: any;
    colorClass?: string;
}) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
                <Icon className={`w-5 h-5 ${colorClass}`} />
            </div>
            <div className="flex flex-col">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {value}
                </span>
                {subValue && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {subValue}
                    </span>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

const SystemMonitorPage = () => {
    const { t } = useTranslation();
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [loading, setLoading] = useState(false); // UI loading state
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Scheduling controls
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL);

    // Concurrency control
    const isFetchingRef = useRef(false);

    /**
     * Fetch health data from backend.
     * Prevents concurrent requests.
     */
    const fetchData = useCallback(async (isAutoRefresh = false) => {
        // Concurrency Lock: Check if a request is already in progress
        if (isFetchingRef.current) {
            console.log('Skipping health check: request already in progress');
            return;
        }

        try {
            isFetchingRef.current = true;
            if (!isAutoRefresh) setLoading(true); // Don't show full loader on auto-refresh
            setError(null);

            const data = await getSystemHealth();
            setHealth(data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Failed to fetch system health:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            if (!isAutoRefresh) setLoading(false);
            isFetchingRef.current = false;
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchData(false);
    }, [fetchData]);

    // Polling interval
    useEffect(() => {
        let timerId: NodeJS.Timeout;

        if (autoRefresh) {
            timerId = setInterval(() => {
                fetchData(true);
            }, intervalMs);
        }

        return () => {
            if (timerId) clearInterval(timerId);
        };
    }, [autoRefresh, intervalMs, fetchData]);

    /** Format seconds to human readable string */
    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    };

    /** Format bytes to MB/GB */
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Header & Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Activity className="w-8 h-8 text-primary-600" />
                            {t('systemMonitor.title')}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            {t('systemMonitor.description')}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                        {/* Auto Refresh Toggle */}
                        <div className="flex items-center gap-2 px-2 border-r border-gray-200 dark:border-gray-700">
                            <label className="text-sm text-gray-600 dark:text-gray-300 select-none cursor-pointer flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={autoRefresh}
                                    onChange={(e) => setAutoRefresh(e.target.checked)}
                                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                />
                                {t('systemMonitor.controls.autoRefresh')}
                            </label>
                        </div>

                        {/* Interval Selector */}
                        <select
                            value={intervalMs}
                            onChange={(e) => setIntervalMs(Number(e.target.value))}
                            disabled={!autoRefresh}
                            className="bg-gray-50 dark:bg-gray-700 border-0 rounded text-sm py-1.5 px-3 focus:ring-2 focus:ring-primary-500 disabled:opacity-50 text-gray-900 dark:text-white"
                            aria-label="Refresh interval"
                        >
                            {REFRESH_INTERVALS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>

                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

                        {/* Manual Refresh */}
                        <button
                            onClick={() => fetchData(false)}
                            disabled={loading || isFetchingRef.current}
                            className="flex items-center gap-2 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={t('systemMonitor.controls.refreshNow')}
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">{t('common.refresh')}</span>
                        </button>

                        {lastUpdated && (
                            <div className="text-xs text-gray-400 px-2 min-w-[80px] text-right">
                                {lastUpdated.toLocaleTimeString()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{t('systemMonitor.error', { error })}</span>
                    </div>
                )}

                {loading && !health ? (
                    // Skeleton Loading
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
                        ))}
                    </div>
                ) : health ? (
                    // Dashboard Content
                    <div className="space-y-8">

                        {/* Services Section */}
                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Box className="w-5 h-5 text-primary-500" />
                                {t('systemMonitor.sections.services')}
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <ServiceCard
                                    title="Database"
                                    icon={Database}
                                    status={health.services.database.status}
                                    enabled={health.services.database.enabled}
                                    subtext={health.services.database.host}
                                />
                                <ServiceCard
                                    title="Redis Cache"
                                    icon={Zap}
                                    status={health.services.redis.status}
                                    enabled={health.services.redis.enabled}
                                    subtext={health.services.redis.host}
                                />
                                <ServiceCard
                                    title="MinIO Storage"
                                    icon={HardDrive}
                                    status={health.services.minio.status}
                                    enabled={health.services.minio.enabled}
                                    subtext={health.services.minio.host}
                                />
                                <ServiceCard
                                    title="Langfuse Trace"
                                    icon={Activity}
                                    status={health.services.langfuse.status}
                                    enabled={health.services.langfuse.enabled}
                                    subtext={health.services.langfuse.host}
                                />
                            </div>
                        </section>


                        {/* System Resources Section */}
                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Server className="w-5 h-5 text-blue-500" />
                                {t('systemMonitor.sections.system')}
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <MetricCard
                                    title={t('systemMonitor.metrics.uptime')}
                                    value={formatUptime(health.system.uptime)}
                                    icon={Clock}
                                    colorClass="text-green-500"
                                />
                                <MetricCard
                                    title="Disk Storage"
                                    value={health.system.disk ? formatBytes(health.system.disk.available) : 'Unknown'}
                                    subValue={health.system.disk ? `Free of ${formatBytes(health.system.disk.total)}` : 'Check Failed'}
                                    icon={HardDrive}
                                    colorClass="text-orange-500"
                                />
                                <MetricCard
                                    title={t('systemMonitor.metrics.memory')}
                                    value={formatBytes(health.system.memory.rss)} // RSS is mostly what we care about (resident set size)
                                    subValue={`Heap: ${formatBytes(health.system.memory.heapUsed)} / ${formatBytes(health.system.memory.heapTotal)}`}
                                    icon={HardDrive}
                                    colorClass="text-purple-500"
                                />
                                <MetricCard
                                    title={t('systemMonitor.metrics.cpuLoad')}
                                    value={health.system.loadAvg?.[0]?.toFixed(2) || '0.00'}
                                    subValue={`1m / 5m / 15m`} // Simplified label
                                    icon={Cpu}
                                    colorClass="text-red-500"
                                />
                                <MetricCard
                                    title={t('systemMonitor.metrics.serverInfo')}
                                    value={health.system.platform}
                                    subValue={`${health.system.arch} | ${health.system.hostname}`}
                                    icon={Server}
                                    colorClass="text-blue-500"
                                />
                            </div>
                        </section>

                        {/* Backend Specifications Section */}
                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Cpu className="w-5 h-5 text-indigo-500" />
                                Backend Specifications
                            </h2>
                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-gray-200 dark:border-gray-700">
                                    <div className="p-4">
                                        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Runtime Environment</h3>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Node.js {health.system.nodeVersion}</span>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-500">{health.system.osType} {health.system.osRelease}</div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">CPU</h3>
                                        <div className="flex items-center gap-2">
                                            <Cpu className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={health.system.cpuModel}>
                                                {health.system.cpuModel}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-500">{health.system.cpus} Cores</div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Memory Capacity</h3>
                                        <div className="flex items-center gap-2">
                                            <HardDrive className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {health.system.totalMemory ? formatBytes(health.system.totalMemory) : 'Unknown'}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-500">Total System Memory</div>
                                    </div>
                                </div>
                            </div>
                        </section>

                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default SystemMonitorPage;
