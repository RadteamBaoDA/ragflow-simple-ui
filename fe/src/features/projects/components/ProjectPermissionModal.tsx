/**
 * ProjectPermissionModal: Modal for managing project-level private access.
 * Toggle between public/private, and assign teams for private access.
 *
 * @description Follows the same design as EntityPermissionModal:
 * - Private Access toggle with lock icon
 * - Team multi-select dropdown
 * - Table of granted teams with delete buttons
 * - Cancel/Save footer with batch save
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Select, Table, Switch, Button, message } from 'antd'
import { Lock, Globe, Users, Trash2 } from 'lucide-react'
import { teamApi, type Team } from '@/features/teams'
import {
  type ProjectPermission,
  getProjectPermissions,
  setProjectPermission,
  removeProjectPermission,
  updateProject,
  type Project,
} from '../api/projectService'

// ============================================================================
// Types
// ============================================================================

/** Props for ProjectPermissionModal */
interface ProjectPermissionModalProps {
  /** Whether modal is visible */
  open: boolean
  /** Close handler */
  onClose: () => void
  /** The project to configure */
  project: Project
  /** Callback after saving */
  onSaved?: () => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * ProjectPermissionModal component.
 * Manages project-level public/private access with team grants.
 *
 * @param props - Modal configuration
 * @returns Modal dialog for project permission management
 */
export const ProjectPermissionModal: React.FC<ProjectPermissionModalProps> = ({
  open,
  onClose,
  project,
  onSaved,
}) => {
  const { t } = useTranslation()

  // Data state
  const [permissions, setPermissions] = useState<ProjectPermission[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [isPrivate, setIsPrivate] = useState(false)

  /**
   * Fetch permissions and teams when modal opens.
   */
  const loadData = useCallback(async () => {
    if (!open || !project.id) return
    setLoading(true)
    try {
      const [perms, teamsList] = await Promise.all([
        getProjectPermissions(project.id),
        teamApi.getTeams(),
      ])
      setPermissions(perms)
      setTeams(teamsList)

      // Sync local state from server
      const teamIds = perms
        .filter((p) => p.grantee_type === 'team')
        .map((p) => p.grantee_id)
      setSelectedTeamIds(teamIds)
      setIsPrivate(project.is_private || false)
    } catch (err) {
      console.error('[ProjectPermissionModal] Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [open, project.id, project.is_private])

  // Load data when modal opens
  useEffect(() => {
    loadData()
  }, [loadData])

  /**
   * Build table data from selected team IDs.
   */
  const selectedTeams = useMemo(() => {
    return teams.filter((team) => selectedTeamIds.includes(team.id))
  }, [selectedTeamIds, teams])

  /**
   * Save all permission changes to server.
   * Updates is_private flag and syncs team permissions.
   */
  const handleSave = async () => {
    setSaving(true)
    try {
      // Step 1: Update project is_private flag
      await updateProject(project.id, { is_private: isPrivate } as Partial<Project>)

      // Step 2: If public, remove all team permissions
      if (!isPrivate) {
        for (const perm of permissions.filter((p) => p.grantee_type === 'team')) {
          await removeProjectPermission(project.id, perm.id)
        }
        message.success(t('projectManagement.permissionsSaved', 'Permissions saved'))
        onSaved?.()
        onClose()
        return
      }

      // Step 3: Diff team permissions
      const existingTeamIds = new Set(
        permissions.filter((p) => p.grantee_type === 'team').map((p) => p.grantee_id),
      )

      // Teams to add
      const teamsToAdd = selectedTeamIds.filter((id) => !existingTeamIds.has(id))
      // Teams to remove
      const teamsToRemove = permissions.filter(
        (p) => p.grantee_type === 'team' && !selectedTeamIds.includes(p.grantee_id),
      )

      // Apply removals
      for (const perm of teamsToRemove) {
        await removeProjectPermission(project.id, perm.id)
      }

      // Apply additions with default tab permissions
      for (const teamId of teamsToAdd) {
        await setProjectPermission(project.id, {
          grantee_type: 'team',
          grantee_id: teamId,
          tab_documents: 'view',
          tab_chat: 'view',
          tab_settings: 'none',
        })
      }

      message.success(t('projectManagement.permissionsSaved', 'Permissions saved'))
      onSaved?.()
      onClose()
    } catch (err) {
      console.error('[ProjectPermissionModal] Failed to save:', err)
      message.error(t('projectManagement.permissionsSaveError', 'Failed to save permissions'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('projectManagement.editPermissions', 'Edit Permissions')}
      width={580}
      footer={
        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <Button onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="primary" onClick={handleSave} loading={saving}>
            {t('common.save', 'Save')}
          </Button>
        </div>
      }
      destroyOnClose
    >
      <div className="space-y-4 py-2">
        {/* Project info banner */}
        <div className="p-3 bg-gray-100 dark:bg-slate-800 rounded-lg">
          <p className="font-medium text-gray-900 dark:text-gray-100">{project.name}</p>
          {project.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {project.description}
            </p>
          )}
        </div>

        {/* Permissions section header */}
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('common.permissions', 'Permissions')}
          </h4>
        </div>

        {/* Public/Private Toggle — dynamic icon, label, and Switch color */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
          <div className="flex items-center gap-3">
            {!isPrivate ? (
              <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <Lock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            )}
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {!isPrivate
                  ? (t('projectManagement.publicAccess', 'Public Access'))
                  : (t('projectManagement.privateAccess', 'Private Access'))
                }
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {!isPrivate
                  ? (t('projectManagement.publicAccessDesc', 'All authenticated users can access this project'))
                  : (t('projectManagement.privateAccessDesc', 'Only selected teams can access this project'))
                }
              </p>
            </div>
          </div>
          <Switch
            checked={!isPrivate}
            onChange={(checked: boolean) => setIsPrivate(!checked)}
            className={!isPrivate ? 'bg-green-500' : 'bg-gray-300'}
          />
        </div>

        {/* Team selection — only shown when Private Access is enabled, with slide-in animation */}
        {isPrivate && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Team Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Users size={14} />
                {t('projectManagement.selectTeams', 'Select Teams')}
              </label>
              <Select
                mode="multiple"
                showSearch
                value={selectedTeamIds}
                onChange={setSelectedTeamIds}
                placeholder={t(
                  'projectManagement.selectTeamsPlaceholder',
                  'Select teams allowed to access this project',
                )}
                className="w-full"
                optionFilterProp="label"
                loading={loading}
                dropdownMatchSelectWidth={false}
                listHeight={400}
                options={teams.map((team) => ({
                  label: team.name,
                  value: team.id,
                }))}
              />
            </div>

            {/* Selected Teams Table */}
            {selectedTeams.length > 0 && (
              <div className="w-full overflow-x-auto">
                <Table
                  dataSource={selectedTeams}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  className="border border-gray-100 dark:border-slate-700 rounded-md overflow-hidden"
                  columns={[
                    {
                      title: t('common.name', 'Name'),
                      dataIndex: 'name',
                      key: 'name',
                      className: 'text-xs',
                    },
                    {
                      title: '',
                      key: 'action',
                      width: 50,
                      align: 'center',
                      render: (_: any, record: Team) => (
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<Trash2 size={14} />}
                          onClick={() =>
                            setSelectedTeamIds(selectedTeamIds.filter((id) => id !== record.id))
                          }
                        />
                      ),
                    },
                  ]}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
