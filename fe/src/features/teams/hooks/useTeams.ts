/**
 * @fileoverview Hook for team list management, CRUD, filtering, and pagination.
 * @module features/teams/hooks/useTeams
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { globalMessage } from '@/app/App'
import { useConfirm } from '@/components/ConfirmDialog'
import { teamApi } from '../api/teamApi'
import type { Team, CreateTeamDTO, UpdateTeamDTO } from '../types/team.types'

// ============================================================================
// Return Type
// ============================================================================

export interface UseTeamsReturn {
    /** All teams */
    teams: Team[]
    /** Whether data is loading */
    loading: boolean
    /** Current search term */
    searchTerm: string
    /** Handle search input */
    handleSearch: (value: string) => void
    /** Current project filter value */
    projectFilter: string
    /** Handle project filter change */
    handleProjectFilter: (value: string) => void
    /** Unique project names for filter dropdown */
    uniqueProjects: string[]
    /** Filtered + paginated teams for display */
    paginatedTeams: Team[]
    /** Total count of filtered teams */
    filteredCount: number
    /** Current page */
    currentPage: number
    /** Page size */
    pageSize: number
    /** Handle pagination change */
    handlePaginationChange: (page: number, size: number) => void
    /** Create a new team */
    createTeam: (data: CreateTeamDTO) => Promise<boolean>
    /** Update an existing team */
    updateTeam: (id: string, data: UpdateTeamDTO) => Promise<boolean>
    /** Delete a team with confirmation */
    deleteTeam: (id: string) => Promise<void>
    /** Reload teams list */
    refresh: () => void
}

// ============================================================================
// Hook
// ============================================================================

/**
 * @description Hook for managing the teams list with CRUD, filtering, and pagination.
 * @returns {UseTeamsReturn} Teams state and handlers.
 */
export const useTeams = (): UseTeamsReturn => {
    const { t } = useTranslation()
    const confirm = useConfirm()

    const [teams, setTeams] = useState<Team[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [projectFilter, setProjectFilter] = useState('ALL')
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const dataFetchedRef = useRef(false)

    /** Fetch all teams from the API */
    const loadTeams = useCallback(async () => {
        try {
            setLoading(true)
            const data = await teamApi.getTeams()
            setTeams(data || [])
        } catch (error) {
            console.error('Failed to load teams:', error)
            setTeams([])
        } finally {
            setLoading(false)
        }
    }, [])

    // Initial load (once)
    useEffect(() => {
        if (dataFetchedRef.current) return
        dataFetchedRef.current = true
        loadTeams()
    }, [loadTeams])

    /** Handle search, reset to page 1 */
    const handleSearch = useCallback((value: string) => {
        setSearchTerm(value)
        setCurrentPage(1)
    }, [])

    /** Handle project filter change, reset to page 1 */
    const handleProjectFilter = useCallback((value: string) => {
        setProjectFilter(value)
        setCurrentPage(1)
    }, [])

    /** Handle pagination controls */
    const handlePaginationChange = useCallback((page: number, size: number) => {
        setCurrentPage(page)
        setPageSize(size)
    }, [])

    /** Unique project names for filter dropdown */
    const uniqueProjects = useMemo(
        () => Array.from(new Set(teams.map(t => t.project_name).filter(Boolean))) as string[],
        [teams]
    )

    /** Filtered teams by search + project */
    const filteredTeams = useMemo(() =>
        teams.filter(team => {
            const matchesSearch = team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                team.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesProject = projectFilter === 'ALL' || team.project_name === projectFilter
            return matchesSearch && matchesProject
        }),
        [teams, searchTerm, projectFilter]
    )

    /** Paginated slice of filtered teams */
    const paginatedTeams = useMemo(
        () => filteredTeams.slice((currentPage - 1) * pageSize, currentPage * pageSize),
        [filteredTeams, currentPage, pageSize]
    )

    /** Create a team, returns true on success */
    const createTeam = useCallback(async (data: CreateTeamDTO): Promise<boolean> => {
        try {
            await teamApi.createTeam(data)
            globalMessage.success(t('common.createSuccess'))
            loadTeams()
            return true
        } catch (error: any) {
            const message = error?.response?.data?.error || error?.message || t('common.error')
            globalMessage.error(message)
            console.error('Failed to create team:', error)
            return false
        }
    }, [loadTeams, t])

    /** Update a team, returns true on success */
    const updateTeam = useCallback(async (id: string, data: UpdateTeamDTO): Promise<boolean> => {
        try {
            await teamApi.updateTeam(id, data)
            globalMessage.success(t('common.updateSuccess'))
            loadTeams()
            return true
        } catch (error: any) {
            const message = error?.response?.data?.error || error?.message || t('common.error')
            globalMessage.error(message)
            console.error('Failed to update team:', error)
            return false
        }
    }, [loadTeams, t])

    /** Delete a team with confirm dialog */
    const deleteTeam = useCallback(async (id: string) => {
        const confirmed = await confirm({ message: t('common.confirmDelete'), variant: 'danger' })
        if (!confirmed) return
        try {
            await teamApi.deleteTeam(id)
            globalMessage.success(t('common.deleteSuccess'))
            loadTeams()
        } catch (error) {
            console.error('Failed to delete team:', error)
        }
    }, [confirm, loadTeams, t])

    return {
        teams,
        loading,
        searchTerm,
        handleSearch,
        projectFilter,
        handleProjectFilter,
        uniqueProjects,
        paginatedTeams,
        filteredCount: filteredTeams.length,
        currentPage,
        pageSize,
        handlePaginationChange,
        createTeam,
        updateTeam,
        deleteTeam,
        refresh: loadTeams,
    }
}
