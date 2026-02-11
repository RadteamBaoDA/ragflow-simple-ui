/**
 * @fileoverview Summary statistic cards for the admin dashboard.
 * @module features/dashboard/components/StatCards
 */
import { useTranslation } from 'react-i18next'
import { Card, Statistic, Row, Col } from 'antd'
import { MessageSquare, Search, Users, BarChart3 } from 'lucide-react'
import type { DashboardStats } from '../types/dashboard.types'

interface StatCardsProps {
    /** Dashboard statistics (null while loading) */
    stats: DashboardStats | null
}

/**
 * @description Row of 4 summary stat cards displaying key dashboard metrics.
 * @param props - Dashboard stats data.
 * @returns Stat cards row element.
 */
export function StatCards({ stats }: StatCardsProps) {
    const { t } = useTranslation()

    return (
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
    )
}
