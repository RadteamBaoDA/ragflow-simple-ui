/**
 * @fileoverview Usage breakdown pie/donut chart for the admin dashboard.
 * @module features/dashboard/components/UsageBreakdownChart
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Empty } from 'antd'
import { Pie } from '@ant-design/charts'
import type { UsageBreakdown } from '../types/dashboard.types'

interface UsageBreakdownChartProps {
    /** Session breakdown data */
    usageBreakdown: UsageBreakdown | undefined
}

/**
 * @description Donut chart showing chat vs search session distribution.
 * @param props - Usage breakdown data.
 * @returns Chart card element.
 */
export function UsageBreakdownChart({ usageBreakdown }: UsageBreakdownChartProps) {
    const { t } = useTranslation()

    /** Pie data filtered to non-zero values */
    const pieData = useMemo(() => {
        if (!usageBreakdown) return []
        return [
            { type: t('dashboard.charts.aiChat'), value: usageBreakdown.chatSessions },
            { type: t('dashboard.charts.aiSearch'), value: usageBreakdown.searchSessions },
        ].filter(d => d.value > 0)
    }, [usageBreakdown, t])

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

    return (
        <Card title={t('dashboard.charts.usageBreakdown')} bordered={false} className="shadow-sm">
            {pieData.some(d => d.value > 0) ? (
                <Pie {...pieConfig} />
            ) : (
                <Empty
                    description={t('common.noData')}
                    style={{ height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                />
            )}
        </Card>
    )
}
