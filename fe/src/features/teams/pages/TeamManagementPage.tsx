/**
 * @fileoverview Team management page.
 * Composes from useTeams/useTeamMembers hooks and dialog/card components.
 * @module features/teams/pages/TeamManagementPage
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Input, Select, Pagination, Button } from 'antd'
import { Plus, Search } from 'lucide-react'
import { HeaderActions } from '@/components/HeaderActions'
import { useFirstVisit, GuidelineDialog } from '@/features/guideline'
import { useTeams } from '../hooks/useTeams'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { TeamCard } from '../components/TeamCard'
import { TeamFormDialog } from '../components/TeamFormDialog'
import { TeamMembersDialog } from '../components/TeamMembersDialog'
import type { Team } from '../types/team.types'

/**
 * @description Team management page with CRUD, member management, search, and filter.
 * @returns {JSX.Element} The rendered page.
 */
export default function TeamManagementPage() {
    const { t } = useTranslation()

    // Guideline dialog
    const { isFirstVisit } = useFirstVisit('iam')
    const [showGuide, setShowGuide] = useState(false)
    useEffect(() => {
        if (isFirstVisit) setShowGuide(true)
    }, [isFirstVisit])

    // Hooks
    const {
        loading,
        searchTerm,
        handleSearch,
        projectFilter,
        handleProjectFilter,
        uniqueProjects,
        paginatedTeams,
        filteredCount,
        currentPage,
        pageSize,
        handlePaginationChange,
        createTeam,
        updateTeam,
        deleteTeam,
        refresh,
    } = useTeams()

    const memberHook = useTeamMembers(refresh)

    // Modal state
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isCreateMode, setIsCreateMode] = useState(false)
    const [isMembersOpen, setIsMembersOpen] = useState(false)

    /** Open create dialog */
    const openCreate = () => {
        setSelectedTeam(null)
        setIsCreateMode(true)
        setIsFormOpen(true)
    }

    /** Open edit dialog */
    const openEdit = (team: Team) => {
        setSelectedTeam(team)
        setIsCreateMode(false)
        setIsFormOpen(true)
    }

    /** Open members dialog */
    const openMembers = (team: Team) => {
        setSelectedTeam(team)
        memberHook.loadMembers(team.id)
        memberHook.ensureUsersLoaded()
        setIsMembersOpen(true)
    }

    /** Close all dialogs */
    const closeDialogs = () => {
        setIsFormOpen(false)
        setIsMembersOpen(false)
        setSelectedTeam(null)
        memberHook.reset()
    }

    return (
        <div className="h-full flex flex-col p-6 max-w-7xl mx-auto">
            {/* Search + Project Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 shrink-0">
                <Input
                    size="large"
                    prefix={<Search className="text-slate-400" size={20} />}
                    placeholder={t('common.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e: any) => handleSearch(e.target.value)}
                    className="flex-1 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
                <Select
                    size="large"
                    value={projectFilter}
                    onChange={handleProjectFilter}
                    className="sm:w-64"
                    options={[
                        { value: 'ALL', label: t('common.allProjects') || 'All Projects' },
                        ...uniqueProjects.map(project => ({ value: project, label: project })),
                    ]}
                />
            </div>

            {/* Team Cards Grid */}
            {loading ? (
                <div className="flex-1 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                        {paginatedTeams.map(team => (
                            <TeamCard
                                key={team.id}
                                team={team}
                                onEdit={openEdit}
                                onDelete={deleteTeam}
                                onManageMembers={openMembers}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Pagination */}
            {!loading && (
                <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700">
                    <Pagination
                        current={currentPage}
                        total={filteredCount}
                        pageSize={pageSize}
                        showSizeChanger={true}
                        showTotal={(total: number) => t('common.totalItems', { total })}
                        pageSizeOptions={['10', '20', '30', '50', '100']}
                        onChange={handlePaginationChange}
                    />
                </div>
            )}

            {/* Create Button */}
            <HeaderActions>
                <Button
                    type="primary"
                    icon={<Plus size={20} />}
                    onClick={openCreate}
                    className="flex items-center gap-2"
                >
                    {t('iam.teams.create')}
                </Button>
            </HeaderActions>

            {/* Create/Edit Dialog */}
            <TeamFormDialog
                open={isFormOpen}
                onClose={closeDialogs}
                team={isCreateMode ? null : selectedTeam}
                onSave={async (data) => {
                    if (isCreateMode) {
                        return createTeam(data)
                    }
                    if (selectedTeam) {
                        return updateTeam(selectedTeam.id, data)
                    }
                    return false
                }}
            />

            {/* Members Dialog */}
            <TeamMembersDialog
                open={isMembersOpen}
                onClose={closeDialogs}
                team={selectedTeam}
                members={memberHook.members}
                availableUsers={memberHook.availableUsers}
                selectedUserIds={memberHook.selectedUserIds}
                onSelectedUserIdsChange={memberHook.setSelectedUserIds}
                onAddMembers={() => selectedTeam && memberHook.addMembers(selectedTeam.id)}
                onRemoveMember={(userId) => selectedTeam && memberHook.removeMember(selectedTeam.id, userId)}
                addMemberError={memberHook.addMemberError}
            />

            <GuidelineDialog
                open={showGuide}
                onClose={() => setShowGuide(false)}
                featureId="iam"
            />
        </div>
    )
}
