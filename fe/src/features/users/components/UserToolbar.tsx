/**
 * @fileoverview Toolbar with search and filter controls for user management.
 * @module features/users/components/UserToolbar
 */
import { useTranslation } from 'react-i18next'
import { Search, Filter, X } from 'lucide-react'
import type { RoleFilter } from '../hooks/useUserManagement'

interface UserToolbarProps {
    /** Current search query */
    searchQuery: string
    /** Update search query */
    onSearchChange: (q: string) => void
    /** Current role filter */
    roleFilter: RoleFilter
    /** Update role filter */
    onRoleFilterChange: (f: RoleFilter) => void
    /** Current department filter */
    departmentFilter: string
    /** Update department filter */
    onDepartmentFilterChange: (d: string) => void
    /** Available department names */
    departments: string[]
}

/**
 * @description Search and filter toolbar for the user management table.
 * @param props - Filter state and handlers.
 * @returns Toolbar element.
 */
export function UserToolbar({
    searchQuery,
    onSearchChange,
    roleFilter,
    onRoleFilterChange,
    departmentFilter,
    onDepartmentFilterChange,
    departments,
}: UserToolbarProps) {
    const { t } = useTranslation()

    return (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
            {/* Search Input */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder={t('userManagement.searchPlaceholder', 'Search users...')}
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent placeholder-slate-400"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                {/* Role Filter */}
                <div className="relative min-w-[140px]">
                    <select
                        value={roleFilter}
                        onChange={(e) => onRoleFilterChange(e.target.value as RoleFilter)}
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
                        onChange={(e) => onDepartmentFilterChange(e.target.value)}
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
    )
}
