/**
 * @fileoverview Admin Activity Dashboard page.
 *
 * Displays summary stat cards, activity trend line chart, top users bar chart,
 * chat vs search pie chart, and sessions per day column chart.
 * All data is filtered by a date range picker.
 *
 * @module features/dashboard/pages/AdminDashboardPage
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  Statistic,
  DatePicker,
  Spin,
  Empty,
  Row,
  Col,
  Button,
  Space,
  Typography,
  Table,
  Select
} from 'antd'
import {
  MessageSquare,
  Search,
  Users,
  BarChart3,
  RefreshCw
} from 'lucide-react'
import { Line, Pie, Column } from '@ant-design/charts'
import dayjs, { Dayjs } from 'dayjs'
import {
  fetchDashboardStats,
  DashboardStats
} from '../api/dashboardService'

const { RangePicker } = DatePicker
const { Title } = Typography

/**
 * AdminDashboardPage
 * Main dashboard page for administrators to view user activity across AI Chat, Search, and System Chat.
 */
function AdminDashboardPage() {
  const { t } = useTranslation()

  // State: date range filter
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  // State: dashboard data
  const [stats, setStats] = useState<DashboardStats | null>(null)
  // State: loading indicator
  const [loading, setLoading] = useState(true)
  // State: top users display limit
  const [topUsersLimit, setTopUsersLimit] = useState(10)

  /**
   * Fetch dashboard data from the API.
   * Converts dayjs dates to ISO strings for the API query.
   */
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Convert dayjs to string for API
      const startDate = dateRange?.[0]?.format('YYYY-MM-DD') || undefined
      const endDate = dateRange?.[1]?.format('YYYY-MM-DD') || undefined
      const data = await fetchDashboardStats(startDate, endDate)
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  // Load data on mount and when date range changes
  useEffect(() => {
    loadData()
  }, [loadData])

  /**
   * Handle date range change from the picker.
   * @param dates - Tuple of start and end dayjs values
   */
  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setDateRange(dates)
  }

  // ============================================================================
  // Chart Configurations
  // ============================================================================

  /**
   * Activity trend line chart config.
   * Shows daily message counts across all three data sources.
   */
  const trendData = stats?.activityTrend?.flatMap(item => [
    { date: item.date, count: item.chatCount, type: t('dashboard.charts.chatMessages') },
    { date: item.date, count: item.searchCount, type: t('dashboard.charts.searchRecords') }
  ]) || []

  const lineConfig = {
    data: trendData,
    xField: 'date',
    yField: 'count',
    colorField: 'type',
    smooth: true,
    height: 300,
    axis: {
      x: { title: t('dashboard.charts.date') },
      y: { title: t('dashboard.charts.messageCount') }
    },
    style: {
      lineWidth: 2,
    },
  }

  /**
   * Top users table data.
   * Sliced by topUsersLimit dropdown selection.
   */
  const topUsersData = stats?.topUsers?.slice(0, topUsersLimit).map((user, index) => ({
    key: user.email,
    rank: index + 1,
    email: user.email,
    sessionCount: user.sessionCount
  })) || []

  // Table columns for top users
  const topUsersColumns = [
    {
      title: '#',
      dataIndex: 'rank',
      key: 'rank',
      width: 50,
    },
    {
      title: t('common.email'),
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: t('dashboard.charts.sessions'),
      dataIndex: 'sessionCount',
      key: 'sessionCount',
      width: 100,
      sorter: (a: any, b: any) => a.sessionCount - b.sessionCount,
    },
  ]

  /**
   * Usage breakdown pie chart config.
   * Shows chat vs search vs system chat session distribution.
   */
  const pieData = stats ? [
    { type: t('dashboard.charts.aiChat'), value: stats.usageBreakdown.chatSessions },
    { type: t('dashboard.charts.aiSearch'), value: stats.usageBreakdown.searchSessions }
  ].filter(d => d.value > 0) : []

  const pieConfig = {
    data: pieData,
    angleField: 'value',
    colorField: 'type',
    height: 300,
    innerRadius: 0.5,
    label: {
      text: 'type',
      position: 'outside' as const,
    },
    tooltip: {
      items: [
        { channel: 'y', name: t('dashboard.charts.sessions') },
      ],
    },
    interaction: {
      elementHighlight: true,
    },
  }

  /**
   * Sessions per day column chart config.
   * Shows daily total sessions (chat + search + system combined).
   */
  const sessionsPerDayData = stats?.activityTrend?.map(item => ({
    date: item.date,
    sessions: item.chatCount + item.searchCount
  })) || []

  const columnConfig = {
    data: sessionsPerDayData,
    xField: 'date',
    yField: 'sessions',
    height: 300,
    axis: {
      x: { title: t('dashboard.charts.date') },
      y: { title: t('dashboard.charts.sessions') }
    },
    style: {
      radiusTopLeft: 4,
      radiusTopRight: 4,
      fill: '#1677ff',
    },
    tooltip: {
      items: [
        { channel: 'y', name: t('dashboard.charts.totalActivity') },
      ],
    },
  }

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="p-6 overflow-auto h-full">
      {/* Header with filters */}
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
            onClick={loadData}
            loading={loading}
          >
            {t('dashboard.refresh')}
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        {/* Summary Stat Cards */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} className="shadow-sm">
              <Statistic
                title={t('dashboard.stats.totalSessions')}
                value={stats?.totalSessions || 0}
                prefix={<MessageSquare size={18} className="text-blue-500 mr-1" />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} className="shadow-sm">
              <Statistic
                title={t('dashboard.stats.totalMessages')}
                value={stats?.totalMessages || 0}
                prefix={<BarChart3 size={18} className="text-green-500 mr-1" />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} className="shadow-sm">
              <Statistic
                title={t('dashboard.stats.uniqueUsers')}
                value={stats?.uniqueUsers || 0}
                prefix={<Users size={18} className="text-purple-500 mr-1" />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} className="shadow-sm">
              <Statistic
                title={t('dashboard.stats.avgMessagesPerSession')}
                value={stats?.avgMessagesPerSession || 0}
                precision={1}
                prefix={<Search size={18} className="text-orange-500 mr-1" />}
              />
            </Card>
          </Col>
        </Row>

        {/* Charts Row 1: Activity Trend + Top Users */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} lg={14}>
            <Card
              title={t('dashboard.charts.activityTrend')}
              bordered={false}
              className="shadow-sm"
            >
              {trendData.length > 0 ? (
                <Line {...lineConfig} />
              ) : (
                <Empty description={t('common.noData')} style={{ height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card
              title={t('dashboard.charts.topUsers')}
              bordered={false}
              className="shadow-sm"
              extra={
                <Select
                  value={topUsersLimit}
                  onChange={setTopUsersLimit}
                  size="small"
                  style={{ width: 100 }}
                  options={[
                    { label: 'Top 5', value: 5 },
                    { label: 'Top 10', value: 10 },
                    { label: 'Top 20', value: 20 },
                    { label: 'Top 50', value: 50 },
                  ]}
                />
              }
            >
              <Table
                columns={topUsersColumns}
                dataSource={topUsersData}
                pagination={false}
                size="small"
                scroll={{ y: 260 }}
                locale={{ emptyText: <Empty description={t('common.noData')} /> }}
              />
            </Card>
          </Col>
        </Row>

        {/* Charts Row 2: Pie Chart + Sessions Per Day */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} lg={10}>
            <Card
              title={t('dashboard.charts.usageBreakdown')}
              bordered={false}
              className="shadow-sm"
            >
              {pieData.some(d => d.value > 0) ? (
                <Pie {...pieConfig} />
              ) : (
                <Empty description={t('common.noData')} style={{ height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card
              title={t('dashboard.charts.sessionsPerDay')}
              bordered={false}
              className="shadow-sm"
            >
              {sessionsPerDayData.length > 0 ? (
                <Column {...columnConfig} />
              ) : (
                <Empty description={t('common.noData')} style={{ height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} />
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}

export default AdminDashboardPage
