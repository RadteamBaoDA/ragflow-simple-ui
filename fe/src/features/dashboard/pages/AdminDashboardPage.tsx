/**
 * @fileoverview Admin Activity Dashboard page.
 * Composes from useDashboardStats hook and chart/stat components.
 * @module features/dashboard/pages/AdminDashboardPage
 */
import { useTranslation } from 'react-i18next'
import { DatePicker, Spin, Button, Space, Typography, Row, Col } from 'antd'
import { RefreshCw } from 'lucide-react'
import dayjs from 'dayjs'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { StatCards } from '../components/StatCards'
import { ActivityTrendChart } from '../components/ActivityTrendChart'
import { TopUsersTable } from '../components/TopUsersTable'
import { UsageBreakdownChart } from '../components/UsageBreakdownChart'
import { SessionsPerDayChart } from '../components/SessionsPerDayChart'

const { RangePicker } = DatePicker
const { Title } = Typography

/**
 * @description Admin dashboard page — displays stats, charts, and top users.
 * @returns {JSX.Element} The rendered dashboard page.
 */
function AdminDashboardPage() {
    const { t } = useTranslation()
    const {
        stats,
        loading,
        dateRange,
        handleDateRangeChange,
        topUsersLimit,
        setTopUsersLimit,
        refresh,
    } = useDashboardStats()

    return (
        <div className="p-6 overflow-auto h-full">
            {/* Header with date range picker and refresh */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <Title level={4} className="!mb-0">{t('dashboard.subtitle')}</Title>
                <Space>
                    <RangePicker
                        value={dateRange as any}
                        onChange={handleDateRangeChange as any}
                        format="YYYY-MM-DD"
                        allowClear
                        placeholder={[t('dashboard.startDate'), t('dashboard.endDate')]}
                        presets={[
                            { label: t('dashboard.presets.last1Day'), value: [dayjs().subtract(1, 'day'), dayjs()] },
                            { label: t('dashboard.presets.last7Days'), value: [dayjs().subtract(7, 'day'), dayjs()] },
                            { label: t('dashboard.presets.last30Days'), value: [dayjs().subtract(30, 'day'), dayjs()] },
                            { label: t('dashboard.presets.last90Days'), value: [dayjs().subtract(90, 'day'), dayjs()] },
                            { label: t('dashboard.presets.thisMonth'), value: [dayjs().startOf('month'), dayjs()] },
                            { label: t('dashboard.presets.lastMonth'), value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                            { label: t('dashboard.presets.last1Year'), value: [dayjs().subtract(1, 'year'), dayjs()] },
                            { label: t('dashboard.presets.last2Years'), value: [dayjs().subtract(2, 'year'), dayjs()] },
                        ]}
                    />
                    <Button
                        icon={<RefreshCw size={16} />}
                        onClick={refresh}
                        loading={loading}
                    >
                        {t('dashboard.refresh')}
                    </Button>
                </Space>
            </div>

            <Spin spinning={loading}>
                {/* Summary Stat Cards */}
                <StatCards stats={stats} />

                {/* Charts Row 1: Activity Trend + Top Users */}
                <Row gutter={[16, 16]} className="mb-6">
                    <Col xs={24} lg={14}>
                        <ActivityTrendChart activityTrend={stats?.activityTrend || []} />
                    </Col>
                    <Col xs={24} lg={10}>
                        <TopUsersTable
                            topUsers={stats?.topUsers || []}
                            limit={topUsersLimit}
                            onLimitChange={setTopUsersLimit}
                        />
                    </Col>
                </Row>

                {/* Charts Row 2: Pie Chart + Sessions Per Day */}
                <Row gutter={[16, 16]} className="mb-6">
                    <Col xs={24} lg={10}>
                        <UsageBreakdownChart usageBreakdown={stats?.usageBreakdown} />
                    </Col>
                    <Col xs={24} lg={14}>
                        <SessionsPerDayChart activityTrend={stats?.activityTrend || []} />
                    </Col>
                </Row>
            </Spin>
        </div>
    )
}

export default AdminDashboardPage
