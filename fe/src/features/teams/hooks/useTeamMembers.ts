/**
 * @fileoverview Hook for managing team member operations.
 * @module features/teams/hooks/useTeamMembers
 */
import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { globalMessage } from '@/app/App'
import { useConfirm } from '@/components/ConfirmDialog'
import { teamApi } from '../api/teamApi'
import { userApi } from '@/features/users'
import type { TeamMember } from '../types/team.types'
import type { User } from '@/features/auth'

// ============================================================================
// Return Type
// ============================================================================

export interface UseTeamMembersReturn {
    /** Current members of the selected team */
    members: TeamMember[]
    /** All users (for add member dropdown) */
    users: User[]
    /** Users available to add (not already in team, role=user|leader) */
    availableUsers: User[]
    /** Currently selected user IDs in the add member control */
    selectedUserIds: string[]
    /** Update selected user IDs */
    setSelectedUserIds: (ids: string[]) => void
    /** Error message from add member operation */
    addMemberError: string | null
    /** Load members for a specific team */
    loadMembers: (teamId: string) => Promise<void>
    /** Ensure users are loaded (lazy fetch) */
    ensureUsersLoaded: () => void
    /** Add selected users to a team */
    addMembers: (teamId: string) => Promise<void>
    /** Remove a member from a team */
    removeMember: (teamId: string, userId: string) => Promise<void>
    /** Reset member state */
    reset: () => void
}

// ============================================================================
// Hook
// ============================================================================

/**
 * @description Hook for managing team member listing and add/remove operations.
 * @param onTeamsChanged - Callback to refresh team list after member changes.
 * @returns {UseTeamMembersReturn} Member state and handlers.
 */
export const useTeamMembers = (onTeamsChanged: () => void): UseTeamMembersReturn => {
    const { t } = useTranslation()
    const confirm = useConfirm()

    const [members, setMembers] = useState<TeamMember[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
    const [addMemberError, setAddMemberError] = useState<string | null>(null)

    /** Fetch members for a specific team */
    const loadMembers = useCallback(async (teamId: string) => {
        try {
            const data = await teamApi.getTeamMembers(teamId)
            setMembers(data)
        } catch (error) {
            console.error('Failed to load members:', error)
        }
    }, [])

    /** Lazy-load users if not already loaded */
    const ensureUsersLoaded = useCallback(() => {
        if (users.length > 0) return
        userApi.getUsers()
            .then(data => setUsers(data))
            .catch((err: unknown) => console.error('Failed to load users:', err))
    }, [users.length])

    /** Users available to add (not already members, role=user|leader) */
    const availableUsers = useMemo(
        () => users.filter(user =>
            (user.role === 'user' || user.role === 'leader') &&
            !members.some(member => member.id === user.id)
        ),
        [users, members]
    )

    /** Add selected users as members */
    const addMembers = useCallback(async (teamId: string) => {
        setAddMemberError(null)
        if (selectedUserIds.length === 0) return
        try {
            await teamApi.addMembers(teamId, selectedUserIds)
            globalMessage.success(t('iam.teams.addMemberSuccess'))
            setSelectedUserIds([])
            loadMembers(teamId)
            onTeamsChanged()
        } catch (error) {
            console.error('Failed to add member:', error)
            setAddMemberError(error instanceof Error ? error.message : t('iam.teams.addMemberError'))
        }
    }, [selectedUserIds, loadMembers, onTeamsChanged, t])

    /** Remove a member with confirmation */
    const removeMember = useCallback(async (teamId: string, userId: string) => {
        const confirmed = await confirm({ message: t('common.confirmDelete'), variant: 'danger' })
        if (!confirmed) return
        await teamApi.removeMember(teamId, userId)
        globalMessage.success(t('iam.teams.removeMemberSuccess'))
        loadMembers(teamId)
        onTeamsChanged()
    }, [confirm, loadMembers, onTeamsChanged, t])

    /** Reset all member-related state */
    const reset = useCallback(() => {
        setMembers([])
        setSelectedUserIds([])
        setAddMemberError(null)
    }, [])

    return {
        members,
        users,
        availableUsers,
        selectedUserIds,
        setSelectedUserIds,
        addMemberError,
        loadMembers,
        ensureUsersLoaded,
        addMembers,
        removeMember,
        reset,
    }
}
