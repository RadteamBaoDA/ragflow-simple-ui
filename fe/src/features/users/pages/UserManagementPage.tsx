/**
 * @fileoverview User management page for administrators.
 * Composes from useUserManagement hook and extracted dialog/toolbar components.
 * @module features/users/pages/UserManagementPage
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Edit2, Globe } from 'lucide-react'
import { useAuth, User } from '@/features/auth'
import { Table, Tag, Card, Space, Avatar, Button, Tooltip, Pagination } from 'antd'
import { useFirstVisit, GuidelineDialog } from '@/features/guideline'
import { useUserManagement } from '../hooks/useUserManagement'
import { UserToolbar } from '../components/UserToolbar'
import { EditRoleDialog } from '../components/EditRoleDialog'
import { IpHistoryDialog } from '../components/IpHistoryDialog'
import { GrantPermissionsDialog } from '../components/GrantPermissionsDialog'

/**
 * @description User management page composing hook + components. Admin-only.
 * @returns {JSX.Element} The rendered page.
 */
export default function UserManagementPage() {
    const { t } = useTranslation()
    const { user: currentUser } = useAuth()

    // Guideline dialog
    const { isFirstVisit } = useFirstVisit('users')
    const [showGuide, setShowGuide] = useState(false)
    useEffect(() => {
        if (isFirstVisit) setShowGuide(true)
    }, [isFirstVisit])

    // Hook
    const mgmt = useUserManagement()

    // Dialog state
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [isEditRoleOpen, setIsEditRoleOpen] = useState(false)
    const [isIpHistoryOpen, setIsIpHistoryOpen] = useState(false)
    const [isPermissionsOpen, setIsPermissionsOpen] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    // Loading / error early returns
    if (mgmt.isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
            </div>
        )
    }
    if (mgmt.error) {
        return <div className="text-center text-red-600 p-4">{mgmt.error}</div>
    }
    if (currentUser?.role !== 'admin') {
        return <div className="text-center text-slate-600 dark:text-slate-400 p-8">{t('userManagement.noPermission')}</div>
    }

    /** Role color helper */
    const roleColor = (role: string) => role === 'admin' ? 'purple' : role === 'leader' ? 'blue' : 'default'

    /** Role labels */
    const roleLabels: Record<string, string> = {
        admin: t('userManagement.admin'),
        leader: t('userManagement.leader'),
        user: t('userManagement.userRole'),
    }

    /** Table columns */
    const columns = [
        {
            title: t('userManagement.user'),
            key: 'user',
            sorter: (a: User, b: User) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''),
            render: (_: any, record: User) => (
                <Space>
                    <Avatar className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium text-sm">
                        {(record.displayName || record.email || '?').charAt(0).toUpperCase()}
                    </Avatar>
                    <span className="font-medium text-slate-900 dark:text-white">{record.displayName || record.email}</span>
                </Space>
            ),
        },
        {
            title: t('userManagement.email'),
            dataIndex: 'email',
            key: 'email',
            sorter: (a: User, b: User) => (a.email || '').localeCompare(b.email || ''),
            render: (text: string) => (
                <Space aria-label="email">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-300">{text}</span>
                </Space>
            ),
        },
        {
            title: t('userManagement.department'),
            dataIndex: 'department',
            key: 'department',
            sorter: (a: User, b: User) => (a.department || '').localeCompare(b.department || ''),
            render: (text: string) => <span className="text-slate-600 dark:text-slate-300">{text || '-'}</span>,
        },
        {
            title: t('userManagement.role'),
            dataIndex: 'role',
            key: 'role',
            sorter: (a: User, b: User) => (a.role || '').localeCompare(b.role || ''),
            render: (role: string) => <Tag color={roleColor(role)} className="capitalize">{roleLabels[role] || role}</Tag>,
        },
        {
            title: t('userManagement.actions'),
            key: 'actions',
            align: 'right' as const,
            render: (_: any, record: User) => {
                const hasIpHistory = (mgmt.ipHistoryMap[record.id] || []).length > 0
                return (
                    <Space>
                        <Tooltip title={t('userManagement.viewIpHistory')}>
                            <Button
                                type="text"
                                icon={<Globe className="w-4 h-4" />}
                                onClick={() => { setSelectedUser(record); setIsIpHistoryOpen(true) }}
                                disabled={!hasIpHistory}
                                className={hasIpHistory ? 'text-slate-400 hover:text-primary-600' : ''}
                            />
                        </Tooltip>
                        <Tooltip title={t('userManagement.editRole')}>
                            <Button
                                type="text"
                                icon={<Edit2 className="w-4 h-4" />}
                                onClick={() => { setSelectedUser(record); setSaveError(null); setIsEditRoleOpen(true) }}
                                className="text-slate-400 hover:text-primary-600"
                            />
                        </Tooltip>
                    </Space>
                )
            },
        },
    ]

    return (
        <>
            <div className="w-full h-full flex flex-col p-6">
                <Card
                    styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
                    className="dark:bg-slate-800 dark:border-slate-700 flex-1 min-h-0 overflow-hidden"
                >
                    <UserToolbar
                        searchQuery={mgmt.searchQuery}
                        onSearchChange={mgmt.setSearchQuery}
                        roleFilter={mgmt.roleFilter}
                        onRoleFilterChange={mgmt.setRoleFilter}
                        departmentFilter={mgmt.departmentFilter}
                        onDepartmentFilterChange={mgmt.setDepartmentFilter}
                        departments={mgmt.departments}
                    />

                    <div className="flex-1 overflow-auto p-4">
                        <Table
                            columns={columns}
                            dataSource={mgmt.paginatedUsers}
                            rowKey="id"
                            loading={mgmt.isLoading}
                            pagination={false}
                            scroll={{ x: true }}
                        />
                    </div>

                    <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700">
                        <Pagination
                            current={mgmt.currentPage}
                            total={mgmt.filteredCount}
                            pageSize={mgmt.pageSize}
                            showSizeChanger={true}
                            showTotal={(total: number) => t('common.totalItems', { total })}
                            pageSizeOptions={['10', '20', '50', '100']}
                            onChange={mgmt.handlePaginationChange}
                        />
                    </div>
                </Card>
            </div>

            {/* Dialogs */}
            <IpHistoryDialog
                open={isIpHistoryOpen}
                onClose={() => setIsIpHistoryOpen(false)}
                user={selectedUser}
                ipHistory={selectedUser ? (mgmt.ipHistoryMap[selectedUser.id] || []) : []}
            />

            <EditRoleDialog
                open={isEditRoleOpen}
                onClose={() => setIsEditRoleOpen(false)}
                user={selectedUser}
                onSave={(userId, role) => {
                    mgmt.updateRole(userId, role)
                    setIsEditRoleOpen(false)
                }}
                saveError={saveError}
            />

            <GrantPermissionsDialog
                open={isPermissionsOpen}
                onClose={() => setIsPermissionsOpen(false)}
                user={selectedUser}
                onSave={(userId, permissions) => {
                    mgmt.updatePermissions(userId, permissions)
                    setIsPermissionsOpen(false)
                }}
            />

            <GuidelineDialog
                open={showGuide}
                onClose={() => setShowGuide(false)}
                featureId="users"
            />
        </>
    )
}
