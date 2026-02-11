/**
 * @fileoverview Hook for user management page logic.
 * Encapsulates user fetching, filtering, pagination, and role/permission mutations.
 * @module features/users/hooks/useUserManagement
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import type { User } from '@/features/auth'
import type { IpHistoryMap } from '../types/user.types'

// ============================================================================
// Types
// ============================================================================

export type RoleFilter = 'all' | 'admin' | 'leader' | 'user'

export interface UseUserManagementReturn {
    /** All users */
    users: User[]
    /** Loading state */
    isLoading: boolean
    /** Error message */
    error: string | null
    /** Search query */
    searchQuery: string
    /** Set search query */
    setSearchQuery: (q: string) => void
    /** Role filter */
    roleFilter: RoleFilter
    /** Set role filter */
    setRoleFilter: (f: RoleFilter) => void
    /** Department filter */
    departmentFilter: string
    /** Set department filter */
    setDepartmentFilter: (d: string) => void
    /** Unique department names */
    departments: string[]
    /** Filtered + paginated users */
    paginatedUsers: User[]
    /** Total filtered count */
    filteredCount: number
    /** Current page */
    currentPage: number
    /** Page size */
    pageSize: number
    /** Handle pagination change */
    handlePaginationChange: (page: number, size: number) => void
    /** IP history map */
    ipHistoryMap: IpHistoryMap
    /** Role mutation */
    updateRole: (userId: string, role: string) => void
    /** Role mutation loading */
    isUpdatingRole: boolean
    /** Permission mutation */
    updatePermissions: (userId: string, permissions: string[]) => void
    /** Permission mutation loading */
    isUpdatingPermissions: boolean
    /** Update local user state after mutation */
    setUsers: React.Dispatch<React.SetStateAction<User[]>>
}

// ============================================================================
// Hook
// ============================================================================

/**
 * @description Hook for user management with CRUD, filtering, pagination, and mutations.
 * @returns {UseUserManagementReturn} User management state and handlers.
 */
export const useUserManagement = (): UseUserManagementReturn => {
    const { t } = useTranslation()

    // Core state
    const [users, setUsers] = useState<User[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [ipHistoryMap, setIpHistoryMap] = useState<IpHistoryMap>({})

    // Filter state
    const [searchQuery, setSearchQuery] = useState('')
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
    const [departmentFilter, setDepartmentFilter] = useState('all')

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)

    /** Fetch all users from the API */
    const fetchUsers = useCallback(async () => {
        try {
            const data = await userApi.getUsers()
            setUsers(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('userManagement.error'))
        } finally {
            setIsLoading(false)
        }
    }, [t])

    /** Fetch IP history for all users */
    const fetchIpHistory = useCallback(async () => {
        try {
            const data = await userApi.getIpHistory()
            setIpHistoryMap(data)
        } catch (err) {
            console.error('Failed to fetch IP history:', err)
        }
    }, [])

    // Initial load
    useEffect(() => {
        fetchUsers()
        fetchIpHistory()
    }, [fetchUsers, fetchIpHistory])

    /** Handle pagination change */
    const handlePaginationChange = useCallback((page: number, size: number) => {
        setCurrentPage(page)
        setPageSize(size)
    }, [])

    /** Unique departments for filter dropdown */
    const departments = useMemo(
        () => Array.from(new Set(users.map(u => u.department).filter(Boolean))) as string[],
        [users]
    )

    /** Filtered users by search + role + department */
    const filteredUsers = useMemo(() =>
        users.filter(user => {
            const searchLower = searchQuery.toLowerCase()
            const matchesSearch =
                (user.displayName?.toLowerCase() || '').includes(searchLower) ||
                (user.email?.toLowerCase() || '').includes(searchLower) ||
                (user.department?.toLowerCase() || '').includes(searchLower)
            const matchesRole = roleFilter === 'all' || user.role === roleFilter
            const matchesDepartment = departmentFilter === 'all' || user.department === departmentFilter
            return matchesSearch && matchesRole && matchesDepartment
        }),
        [users, searchQuery, roleFilter, departmentFilter]
    )

    /** Paginated slice of filtered users */
    const paginatedUsers = useMemo(
        () => filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize),
        [filteredUsers, currentPage, pageSize]
    )

    // Role mutation
    const updateRoleMutation = useMutation({
        mutationKey: ['update', 'user', 'role'],
        mutationFn: ({ userId, role }: { userId: string; role: string }) =>
            userApi.updateUserRole(userId, role),
        onSuccess: (_data, variables) => {
            setUsers(prev => prev.map(u =>
                u.id === variables.userId ? { ...u, role: variables.role as any } : u
            ))
        },
        meta: { successMessage: t('userManagement.roleUpdateSuccess') },
    })

    // Permission mutation
    const updatePermissionsMutation = useMutation({
        mutationKey: ['update', 'user', 'permissions'],
        mutationFn: ({ userId, permissions }: { userId: string; permissions: string[] }) =>
            userApi.updateUserPermissions(userId, permissions),
        onSuccess: (_data, variables) => {
            setUsers(prev => prev.map(u =>
                u.id === variables.userId ? { ...u, permissions: variables.permissions } : u
            ))
        },
        meta: { successMessage: t('userManagement.permissionsUpdateSuccess') },
    })

    return {
        users,
        isLoading,
        error,
        searchQuery,
        setSearchQuery,
        roleFilter,
        setRoleFilter,
        departmentFilter,
        setDepartmentFilter,
        departments,
        paginatedUsers,
        filteredCount: filteredUsers.length,
        currentPage,
        pageSize,
        handlePaginationChange,
        ipHistoryMap,
        updateRole: (userId, role) => updateRoleMutation.mutate({ userId, role }),
        isUpdatingRole: updateRoleMutation.isPending,
        updatePermissions: (userId, permissions) => updatePermissionsMutation.mutate({ userId, permissions }),
        isUpdatingPermissions: updatePermissionsMutation.isPending,
        setUsers,
    }
}
