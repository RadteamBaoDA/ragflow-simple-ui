/**
 * @fileoverview Sessions per day column chart for the admin dashboard.
 * @module features/dashboard/components/SessionsPerDayChart
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Empty } from 'antd'
import { Column } from '@ant-design/charts'
import type { DailyActivity } from '../types/dashboard.types'

interface SessionsPerDayChartProps {
    /** Daily activity trend data */
    activityTrend: DailyActivity[]
}

/**
 * @description Column chart showing total daily sessions (chat + search combined).
 * @param props - Activity trend data array.
 * @returns Chart card element.
 */
export function SessionsPerDayChart({ activityTrend }: SessionsPerDayChartProps) {
    const { t } = useTranslation()

    /** Combined daily session totals */
    const sessionsPerDayData = useMemo(() =>
        activityTrend.map(item => ({
            date: item.date,
            sessions: item.chatCount + item.searchCount,
        })),
        [activityTrend]
    )

    const columnConfig = {
        data: sessionsPerDayData,
        xField: 'date',
        yField: 'sessions',
        height: 300,
        axis: {
            x: { title: t('dashboard.charts.date') },
            y: { title: t('dashboard.charts.sessions') },
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

    return (
        <Card title={t('dashboard.charts.sessionsPerDay')} bordered={false} className="shadow-sm">
            {sessionsPerDayData.length > 0 ? (
                <Column {...columnConfig} />
            ) : (
                <Empty
                    description={t('common.noData')}
                    style={{ height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                />
            )}
        </Card>
    )
}
