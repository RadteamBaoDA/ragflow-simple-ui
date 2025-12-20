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

import { useState, useEffect } from 'react';
import { useAuth, User } from '../hooks/useAuth';
import { Dialog } from '../components/Dialog';
import { Mail, Edit2, Globe, Search, Filter, X, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

    // Filter and Sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'leader' | 'user'>('all');
    const [departmentFilter, setDepartmentFilter] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof User | 'email'; direction: 'asc' | 'desc' }>({
        key: 'displayName',
        direction: 'asc'
    });

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
    const handleViewIpHistory = (user: User) => {
        setIpDialogUser(user);
        setIsIpDialogOpen(true);
    };

    /**
     * Format date for display.
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
    }).sort((a, b) => {
        const aValue = (a[sortConfig.key as keyof User] || '').toString().toLowerCase();
        const bValue = (b[sortConfig.key as keyof User] || '').toString().toLowerCase();

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: keyof User | 'email') => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // ============================================================================
    // Handlers
    // ============================================================================

    const [saveError, setSaveError] = useState<string | null>(null);

    // ...

    /**
     * Handle edit button click - open dialog with user's current role.
     */
    const handleEditClick = (user: User) => {
        setSelectedUser(user);
        setNewRole(user.role);
        setSaveError(null);
        setIsEditModalOpen(true);
    };

    /**
     * Save role change via API and update local state.
     */
    const handleSaveRole = async () => {
        if (!selectedUser) return;
        setSaveError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/users/${selectedUser.id}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
                credentials: 'include',
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to update role');
            }

            // Update local state to reflect change
            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, role: newRole } : u));
            setIsEditModalOpen(false);
        } catch (err) {
            console.error('Failed to update role:', err);
            setSaveError(err instanceof Error ? err.message : 'An error occurred');
        }
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

    return (
        <div className="w-full h-full flex flex-col">
            <div className="bg-white dark:bg-slate-800 flex-1 overflow-hidden flex flex-col">
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

                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                <th
                                    className="p-4 text-sm font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors select-none group"
                                    onClick={() => handleSort('displayName')}
                                >
                                    <div className="flex items-center gap-1">
                                        {t('userManagement.user')}
                                        {sortConfig.key === 'displayName' ? (
                                            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-primary-600 dark:text-primary-400" /> : <ArrowDown className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                                        ) : (
                                            <ArrowUp className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="p-4 text-sm font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors select-none group"
                                    onClick={() => handleSort('email')}
                                >
                                    <div className="flex items-center gap-1">
                                        {t('userManagement.email')}
                                        {sortConfig.key === 'email' ? (
                                            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-primary-600 dark:text-primary-400" /> : <ArrowDown className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                                        ) : (
                                            <ArrowUp className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="p-4 text-sm font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors select-none group"
                                    onClick={() => handleSort('department')}
                                >
                                    <div className="flex items-center gap-1">
                                        {t('userManagement.department')}
                                        {sortConfig.key === 'department' ? (
                                            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-primary-600 dark:text-primary-400" /> : <ArrowDown className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                                        ) : (
                                            <ArrowUp className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="p-4 text-sm font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors select-none group"
                                    onClick={() => handleSort('role')}
                                >
                                    <div className="flex items-center gap-1">
                                        {t('userManagement.role')}
                                        {sortConfig.key === 'role' ? (
                                            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-primary-600 dark:text-primary-400" /> : <ArrowDown className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                                        ) : (
                                            <ArrowUp className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </div>
                                </th>
                                <th className="p-4 text-sm font-medium text-slate-500 dark:text-slate-400 text-right">{t('userManagement.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredUsers.map((user) => {
                                const userIpHistory = ipHistoryMap[user.id] || [];
                                const hasIpHistory = userIpHistory.length > 0;

                                return (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium text-sm">
                                                    {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-slate-900 dark:text-white">{user.displayName || user.email}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <Mail className="w-4 h-4 text-slate-400" />
                                                {user.email}
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-600 dark:text-slate-300">
                                            {user.department || '-'}
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${user.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                                    user.role === 'leader' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                                        'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                {user.role === 'admin' ? t('userManagement.admin') :
                                                    user.role === 'leader' ? t('userManagement.leader') :
                                                        t('userManagement.userRole')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleViewIpHistory(user)}
                                                    className={`p-2 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 ${hasIpHistory
                                                        ? 'text-slate-400 hover:text-primary-600 dark:hover:text-primary-400'
                                                        : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                                        }`}
                                                    title={t('userManagement.viewIpHistory')}
                                                    disabled={!hasIpHistory}
                                                >
                                                    <Globe className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleEditClick(user)}
                                                    className="p-2 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                                                    title={t('userManagement.editRole')}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* IP History Dialog */}
            <Dialog
                open={isIpDialogOpen}
                onClose={() => setIsIpDialogOpen(false)}
                title={t('userManagement.ipHistoryTitle')}
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
                    <div className="flex items-center gap-3 p-3 mb-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                            {(ipDialogUser?.displayName || ipDialogUser?.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-medium text-slate-900 dark:text-white">{ipDialogUser?.displayName || ipDialogUser?.email}</div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">{ipDialogUser?.email}</div>
                        </div>
                    </div>

                    {/* IP History Table */}
                    {ipDialogUser && (ipHistoryMap[ipDialogUser.id] || []).length > 0 ? (
                        <div className="bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-600">
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {t('userManagement.ipAddress')}
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {t('userManagement.lastAccess')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                                    {(ipHistoryMap[ipDialogUser.id] || []).map((record) => (
                                        <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-600/50">
                                            <td className="px-4 py-2 font-mono text-slate-700 dark:text-slate-300">
                                                {record.ip_address}
                                            </td>
                                            <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                                                {formatDate(record.last_accessed_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                            {(selectedUser?.displayName || selectedUser?.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-medium text-slate-900 dark:text-white">{selectedUser?.displayName || selectedUser?.email}</div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">{selectedUser?.email}</div>
                            {selectedUser?.job_title && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedUser.job_title}</div>
                            )}
                            {selectedUser?.department && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">{selectedUser.department}</div>
                            )}
                            {selectedUser?.mobile_phone && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">{selectedUser.mobile_phone}</div>
                            )}
                        </div>
                    </div>

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
        </div>
    );
}
