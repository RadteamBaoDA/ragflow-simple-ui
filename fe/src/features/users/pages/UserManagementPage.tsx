/**
 * @fileoverview User management page for administrators.
 * 
 * Admin-only page for managing user roles:
 * - View all registered users in a data table
 * - Edit user roles (admin, manager, user)
 * - Display user details (email, department, job title)
 * - View user IP access history
 * - Full i18n support for all text
 * 
 * Page title is displayed in the Layout header.
 * 
 * @module pages/UserManagementPage
 */

import { Mail, Edit2, Globe, Search, Filter, X, AlertCircle } from 'lucide-react';
import { userService } from '../api/userService';
import { useState, useEffect } from 'react';
import { useAuth, User } from '@/features/auth';
import { Dialog } from '@/components/Dialog';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Table, Tag, Card, Space, Avatar, Button, Tooltip, Pagination } from 'antd';
import { useFirstVisit, GuidelineDialog } from '@/features/guideline';

/** API base URL from environment */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/** User IP history record */
interface UserIpHistory {
    id: number;
    user_id: string;
    ip_address: string;
    last_accessed_at: string;
}

/** Map of user ID to their IP history */
type IpHistoryMap = Record<string, UserIpHistory[]>;

// ============================================================================
// Component
// ============================================================================

/**
 * User management page for administrators.
 * 
 * Features:
 * - User list with avatar, name, email, department
 * - Role badges (admin, manager, user) with color coding
 * - Edit role dialog with role descriptions
 * - Admin-only access (verified client-side)
 */
export default function UserManagementPage() {
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();

    const { isFirstVisit } = useFirstVisit('users');
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => {
        if (isFirstVisit) {
            setShowGuide(true);
        }
    }, [isFirstVisit]);

    // State management
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit dialog state
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [newRole, setNewRole] = useState<'admin' | 'leader' | 'user'>('user');

    // IP history state
    const [ipHistoryMap, setIpHistoryMap] = useState<IpHistoryMap>({});
    const [isIpDialogOpen, setIsIpDialogOpen] = useState(false);
    const [ipDialogUser, setIpDialogUser] = useState<User | null>(null);

    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'leader' | 'user'>('all');
    const [departmentFilter, setDepartmentFilter] = useState<string>('all');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // ============================================================================
    // Effects & Data Fetching
    // ============================================================================

    /**
     * Effect: Load users on component mount.
     */
    useEffect(() => {
        fetchUsers();
        fetchIpHistory();
    }, []);

    /**
     * Fetch all users from the API.
     * Requires admin credentials (handled by backend).
     */
    /**
     * Fetch all users from the API.
     * Requires admin credentials (verified by backend).
     * Updates loading and error states.
     */
    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users`, {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('userManagement.error'));
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Fetch IP history for all users.
     */
    /**
     * Fetch IP access history for users.
     * Populates the map of user IDs to IP history records.
     */
    const fetchIpHistory = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/ip-history`, {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch IP history');
            const data = await response.json();
            setIpHistoryMap(data);
        } catch (err) {
            console.error('Failed to fetch IP history:', err);
        }
    };

    /**
     * Handle IP history button click - open dialog.
     */
    /**
     * Open the IP history dialog for a specific user.
     * @param user - The user whose history to view.
     */
    const handleViewIpHistory = (user: User) => {
        setIpDialogUser(user);
        setIsIpDialogOpen(true);
    };

    /**
     * Format date for display.
     */
    /**
     * Format a date string to current locale string.
     * @param dateString - ISO date string.
     */
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    // ============================================================================
    // Filter & Sort Logic
    // ============================================================================

    // Get unique departments for filter dropdown
    const departments = Array.from(new Set(users.map(u => u.department).filter(Boolean))) as string[];

    const filteredUsers = users.filter(user => {
        // Search filter
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
            (user.displayName?.toLowerCase() || '').includes(searchLower) ||
            (user.email?.toLowerCase() || '').includes(searchLower) ||
            (user.department?.toLowerCase() || '').includes(searchLower);

        // Role filter
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;

        // Department filter
        const matchesDepartment = departmentFilter === 'all' || user.department === departmentFilter;

        return matchesSearch && matchesRole && matchesDepartment;
    });



    // ============================================================================
    // Mutations
    // ============================================================================

    const updateRoleMutation = useMutation({
        mutationKey: ['update', 'user', 'role'],
        mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
            const response = await fetch(`${API_BASE_URL}/api/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
                credentials: 'include',
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to update role');
            }
            return response.json();
        },
        onSuccess: (_data, variables) => {
            // Update local state if needed, but easier to just invalidate or update users array
            setUsers(prev => prev.map(u => u.id === variables.userId ? { ...u, role: variables.role as any } : u));
            setIsEditModalOpen(false);
        },
        meta: { successMessage: t('userManagement.roleUpdateSuccess') }
    });

    const updatePermissionsMutation = useMutation({
        mutationKey: ['update', 'user', 'permissions'],
        mutationFn: ({ userId, permissions }: { userId: string, permissions: string[] }) =>
            userService.updateUserPermissions(userId, permissions),
        onSuccess: (_data, variables) => {
            setUsers(prev => prev.map(u => u.id === variables.userId ? { ...u, permissions: variables.permissions } : u));
            setIsPermissionModalOpen(false);
        },
        meta: { successMessage: t('userManagement.permissionsUpdateSuccess') }
    });

    // ============================================================================
    const [saveError, setSaveError] = useState<string | null>(null);

    // Permission Dialog State
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

    // ...

    /**
     * Handle edit button click - open dialog with user's current role.
     */
    /**
     * Open the edit role dialog for a user.
     * Pre-fills the current role.
     * @param user - The user to edit.
     */
    const handleEditClick = (user: User) => {
        setSelectedUser(user);
        setNewRole(user.role);
        setSaveError(null);
        setIsEditModalOpen(true);
    };

    /* const handlePermissionClick = (user: User) => {
        setSelectedUser(user);
        setSelectedPermissions(user.permissions || []);
        setIsPermissionModalOpen(true);
    }; */

    const handleSavePermissions = async () => {
        if (!selectedUser) return;
        updatePermissionsMutation.mutate({ userId: selectedUser.id, permissions: selectedPermissions });
    };


    /**
     * Save role change via API and update local state.
     */
    /**
     * Save the new role for the selected user.
     * Triggers the mutation to update the backend.
     */
    const handleSaveRole = async () => {
        if (!selectedUser) return;
        updateRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
    };



    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-600 p-4">
                {error}
            </div>
        );
    }

    // Only allow admins to see this page content (double check, though route is protected)
    if (currentUser?.role !== 'admin') {
        return (
            <div className="text-center text-slate-600 dark:text-slate-400 p-8">
                {t('userManagement.noPermission')}
            </div>
        );
    }

    // ============================================================================
    // Table Columns
    // ============================================================================

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
                    <span className="font-medium text-slate-900 dark:text-white">
                        {record.displayName || record.email}
                    </span>
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
            render: (role: string) => {
                const labels: Record<string, string> = {
                    admin: t('userManagement.admin'),
                    leader: t('userManagement.leader'),
                    user: t('userManagement.userRole'),
                };
                return (
                    <Tag color={recordRoleColor(role)} className="capitalize">
                        {labels[role] || role}
                    </Tag>
                );
            },
        },
        {
            title: t('userManagement.actions'),
            key: 'actions',
            align: 'right' as const,
            render: (_: any, record: User) => {
                const userIpHistory = ipHistoryMap[record.id] || [];
                const hasIpHistory = userIpHistory.length > 0;
                return (
                    <Space>
                        <Tooltip title={t('userManagement.viewIpHistory')}>
                            <Button
                                type="text"
                                icon={<Globe className="w-4 h-4" />}
                                onClick={() => handleViewIpHistory(record)}
                                disabled={!hasIpHistory}
                                className={hasIpHistory ? 'text-slate-400 hover:text-primary-600' : ''}
                            />
                        </Tooltip>
                        <Tooltip title={t('userManagement.editRole')}>
                            <Button
                                type="text"
                                icon={<Edit2 className="w-4 h-4" />}
                                onClick={() => handleEditClick(record)}
                                className="text-slate-400 hover:text-primary-600"
                            />
                        </Tooltip>
                    </Space>
                );
            },
        },
    ];

    function recordRoleColor(role: string) {
        if (role === 'admin') return 'purple';
        if (role === 'leader') return 'blue';
        return 'default';
    }

    return (
        <>
            <div className="w-full h-full flex flex-col p-6">
                <Card
                    styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
                    className="dark:bg-slate-800 dark:border-slate-700 flex-1 min-h-0 overflow-hidden"
                >
                    {/* Toolbar */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={t('userManagement.searchPlaceholder', 'Search users...')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent placeholder-slate-400"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                            {/* Role Filter */}
                            <div className="relative min-w-[140px]">
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value as any)}
                                    className="w-full appearance-none pl-3 pr-8 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                                >
                                    <option value="all">{t('userManagement.allRoles', 'All Roles')}</option>
                                    <option value="admin">{t('userManagement.admin')}</option>
                                    <option value="leader">{t('userManagement.leader')}</option>
                                    <option value="user">{t('userManagement.userRole')}</option>
                                </select>
                                <Filter className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>

                            {/* Department Filter */}
                            <div className="relative min-w-[160px]">
                                <select
                                    value={departmentFilter}
                                    onChange={(e) => setDepartmentFilter(e.target.value)}
                                    className="w-full appearance-none pl-3 pr-8 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                                >
                                    <option value="all">{t('userManagement.allDepartments', 'All Departments')}</option>
                                    {departments.map(dept => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </select>
                                <Filter className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4">
                        <Table
                            columns={columns}
                            dataSource={filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
                            rowKey="id"
                            loading={isLoading}
                            pagination={false}
                            scroll={{ x: true }}
                        />
                    </div>
                    <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700">
                        <Pagination
                            current={currentPage}
                            total={filteredUsers.length}
                            pageSize={pageSize}
                            showSizeChanger={true}
                            showTotal={(total: number) => t('common.totalItems', { total })}
                            pageSizeOptions={['10', '20', '50', '100']}
                            onChange={(page: number, size: number) => {
                                setCurrentPage(page);
                                setPageSize(size);
                            }}
                        />
                    </div>
                </Card>
            </div>

            {/* IP History Dialog */}
            <Dialog
                open={isIpDialogOpen}
                onClose={() => setIsIpDialogOpen(false)}
                title={t('userManagement.ipHistoryTitle')}
                maxWidth="3xl"
                footer={
                    <button
                        onClick={() => setIsIpDialogOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        {t('common.close')}
                    </button>
                }
            >
                <div className="py-4">
                    {/* User info header */}
                    {ipDialogUser && (
                        <div className="flex items-center gap-3 p-3 mb-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                                {(ipDialogUser.displayName || ipDialogUser.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">{ipDialogUser.displayName || ipDialogUser.email}</div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">{ipDialogUser.email}</div>
                            </div>
                        </div>
                    )}

                    {/* IP History Table */}
                    {ipDialogUser && (ipHistoryMap[ipDialogUser.id] || []).length > 0 ? (
                        <div className="overflow-hidden">
                            <Table
                                dataSource={ipHistoryMap[ipDialogUser.id]}
                                rowKey="id"
                                pagination={{ pageSize: 10 }}
                                size="small"
                                columns={[
                                    {
                                        title: t('userManagement.ipAddress'),
                                        dataIndex: 'ip_address',
                                        key: 'ip_address',
                                        render: (text) => <span className="font-mono">{text}</span>
                                    },
                                    {
                                        title: t('userManagement.lastAccess'),
                                        dataIndex: 'last_accessed_at',
                                        key: 'last_accessed_at',
                                        render: (text) => formatDate(text)
                                    }
                                ]}
                            />
                        </div>
                    ) : (
                        <div className="text-center text-slate-500 dark:text-slate-400 py-8">
                            {t('userManagement.noIpHistory')}
                        </div>
                    )}
                </div>
            </Dialog>

            {/* Edit Role Dialog */}
            <Dialog
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title={t('userManagement.editUserRole')}
                footer={
                    <>
                        <button
                            onClick={() => setIsEditModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleSaveRole}
                            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
                        >
                            {t('userManagement.saveChanges')}
                        </button>
                    </>
                }
            >
                <div className="space-y-4 py-4">
                    {selectedUser && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                                {(selectedUser.displayName || selectedUser.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">{selectedUser.displayName || selectedUser.email}</div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">{selectedUser.email}</div>
                                {selectedUser.job_title && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedUser.job_title}</div>
                                )}
                                {selectedUser.department && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{selectedUser.department}</div>
                                )}
                                {selectedUser.mobile_phone && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{selectedUser.mobile_phone}</div>
                                )}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {t('userManagement.role')}
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            {['admin', 'leader', 'user'].map((role) => (
                                <label
                                    key={role}
                                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all
                        ${newRole === role
                                            ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-600'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
                                >
                                    <input
                                        type="radio"
                                        name="role"
                                        value={role}
                                        checked={newRole === role}
                                        onChange={(e) => setNewRole(e.target.value as any)}
                                        className="sr-only"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-slate-900 dark:text-white capitalize">
                                            {role === 'admin' ? t('userManagement.admin') :
                                                role === 'leader' ? t('userManagement.leader') :
                                                    t('userManagement.userRole')}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            {role === 'admin' ? t('userManagement.adminDescription') :
                                                role === 'leader' ? t('userManagement.leaderDescription') :
                                                    t('userManagement.userDescription')}
                                        </div>
                                    </div>
                                    {newRole === role && (
                                        <div className="w-2 h-2 rounded-full bg-primary-600 ml-2" />
                                    )}
                                </label>
                            ))}
                        </div>
                        {saveError && (
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-400">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div className="text-sm">{saveError}</div>
                            </div>
                        )}
                    </div>
                </div>
            </Dialog>

            {/* Grant Permission Dialog */}
            <Dialog
                open={isPermissionModalOpen}
                onClose={() => setIsPermissionModalOpen(false)}
                title={t('userManagement.grantPermissions')}
                maxWidth="2xl"
                footer={
                    <>
                        <button
                            onClick={() => setIsPermissionModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleSavePermissions}
                            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
                        >
                            {t('common.save')}
                        </button>
                    </>
                }
            >
                <div className="py-4 space-y-4">
                    {selectedUser && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                                {(selectedUser.displayName || selectedUser.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">{selectedUser.displayName || selectedUser.email}</div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">{selectedUser.email}</div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {t('userManagement.permissions')}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                { id: 'view_chat', label: t('userManagement.permissionLabels.view_chat') },
                                { id: 'view_search', label: t('userManagement.permissionLabels.view_search') },
                                { id: 'manage_knowledge', label: t('userManagement.permissionLabels.manage_knowledge') },
                                { id: 'manage_users', label: t('userManagement.permissionLabels.manage_users') },
                                { id: 'view_system_monitor', label: t('userManagement.permissionLabels.view_system_monitor') },
                            ].map((perm) => (
                                <label key={perm.id} className="flex items-center p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                        checked={selectedPermissions.includes(perm.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedPermissions([...selectedPermissions, perm.id]);
                                            } else {
                                                setSelectedPermissions(selectedPermissions.filter(p => p !== perm.id));
                                            }
                                        }}
                                    />
                                    <span className="ml-2 text-sm text-slate-700 dark:text-slate-300">{perm.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </Dialog>

            <GuidelineDialog
                open={showGuide}
                onClose={() => setShowGuide(false)}
                featureId="users"
            />
        </>
    );
}
