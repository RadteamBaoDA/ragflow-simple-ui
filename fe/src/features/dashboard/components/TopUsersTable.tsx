/**
 * @fileoverview Top users table for the admin dashboard.
 * @module features/dashboard/components/TopUsersTable
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Table, Select, Empty } from 'antd'
import type { TopUser } from '../types/dashboard.types'

interface TopUsersTableProps {
    /** Array of top user data */
    topUsers: TopUser[]
    /** Current display limit */
    limit: number
    /** Callback to change display limit */
    onLimitChange: (limit: number) => void
}

/**
 * @description Table showing top active users with a limit selector.
 * @param props - Top user data, limit, and change handler.
 * @returns Table card element.
 */
export function TopUsersTable({ topUsers, limit, onLimitChange }: TopUsersTableProps) {
    const { t } = useTranslation()

    /** Sliced and ranked table data */
    const tableData = useMemo(() =>
        topUsers.slice(0, limit).map((user, index) => ({
            key: user.email,
            rank: index + 1,
            email: user.email,
            sessionCount: user.sessionCount,
        })),
        [topUsers, limit]
    )

    const columns = [
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

    return (
        <Card
            title={t('dashboard.charts.topUsers')}
            bordered={false}
            className="shadow-sm"
            extra={
                <Select
                    value={limit}
                    onChange={onLimitChange}
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
                columns={columns}
                dataSource={tableData}
                pagination={false}
                size="small"
                scroll={{ y: 260 }}
                locale={{ emptyText: <Empty description={t('common.noData')} /> }}
            />
        </Card>
    )
}
