/**
 * @fileoverview Activity trend line chart for the admin dashboard.
 * @module features/dashboard/components/ActivityTrendChart
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Empty } from 'antd'
import { Line } from '@ant-design/charts'
import type { DailyActivity } from '../types/dashboard.types'

interface ActivityTrendChartProps {
    /** Daily activity trend data */
    activityTrend: DailyActivity[]
}

/**
 * @description Line chart showing daily chat and search message counts.
 * @param props - Activity trend data array.
 * @returns Chart card element.
 */
export function ActivityTrendChart({ activityTrend }: ActivityTrendChartProps) {
    const { t } = useTranslation()

    /** Transform raw trend data into chart-ready format */
    const trendData = useMemo(() =>
        activityTrend.flatMap(item => [
            { date: item.date, count: item.chatCount, type: t('dashboard.charts.chatMessages') },
            { date: item.date, count: item.searchCount, type: t('dashboard.charts.searchRecords') },
        ]),
        [activityTrend, t]
    )

    const lineConfig = {
        data: trendData,
        xField: 'date',
        yField: 'count',
        colorField: 'type',
        smooth: true,
        height: 300,
        axis: {
            x: { title: t('dashboard.charts.date') },
            y: { title: t('dashboard.charts.messageCount') },
        },
        style: {
            lineWidth: 2,
        },
    }

    return (
        <Card title={t('dashboard.charts.activityTrend')} bordered={false} className="shadow-sm">
            {trendData.length > 0 ? (
                <Line {...lineConfig} />
            ) : (
                <Empty
                    description={t('common.noData')}
                    style={{ height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                />
            )}
        </Card>
    )
}
