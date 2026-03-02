/**
 * EntityPermissionModal: Modal for managing per-entity permissions.
 * Opens from a lock icon on each category/chat/search row.
 *
 * @description Design inspired by RAGFlow's "Edit Permissions" modal:
 * - Entity info banner at top
 * - Private Access toggle
 * - Separate team/user multi-select dropdowns
 * - Name/Email table of granted users with delete buttons
 * - Cancel/Save footer with batch save
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Select, Table, Switch, Button, message, Divider } from 'antd'
import { Lock, Users, User, Trash2 } from 'lucide-react'
import { teamApi, type Team } from '@/features/teams'
import { userApi } from '@/features/users'
import { User as UserType } from '@/features/auth'
import {
  type ProjectEntityPermission,
  getEntityPermissionsByEntity,
  setEntityPermission,
  removeEntityPermission,
} from '../api/projectService'

// ============================================================================
// Types
// ============================================================================

/** Props for EntityPermissionModal */
interface EntityPermissionModalProps {
  /** Whether modal is visible */
  open: boolean
  /** Close handler */
  onClose: () => void
  /** Project UUID */
  projectId: string
  /** Entity type: 'category' | 'chat' | 'search' */
  entityType: 'category' | 'chat' | 'search'
  /** Entity UUID */
  entityId: string
  /** Entity display name (for header) */
  entityName: string
}

// ============================================================================
// Component
// ============================================================================

/**
 * EntityPermissionModal component.
 * Manages per-entity permission grantees with a clean form layout.
 *
 * @param props - Modal configuration
 * @returns Modal dialog for permission management
 */
export const EntityPermissionModal: React.FC<EntityPermissionModalProps> = ({
  open,
  onClose,
  projectId,
  entityType,
  entityId,
  entityName,
}) => {
  const { t } = useTranslation()

  // Data state
  const [permissions, setPermissions] = useState<ProjectEntityPermission[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state: selected team/user IDs (local until Save)
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [isPrivate, setIsPrivate] = useState(false)

  /**
   * Fetch permissions and reference data (teams, users) when modal opens.
   */
  const loadData = useCallback(async () => {
    if (!open || !entityId) return
    setLoading(true)
    try {
      const [perms, teamsList, usersList] = await Promise.all([
        getEntityPermissionsByEntity(projectId, entityType, entityId),
        teamApi.getTeams(),
        userApi.getUsers(),
      ])
      setPermissions(perms)
      setTeams(teamsList)
      setUsers(usersList)

      // Sync local state from server permissions
      const teamIds = perms
        .filter((p) => p.grantee_type === 'team')
        .map((p) => p.grantee_id)
      const userIds = perms
        .filter((p) => p.grantee_type === 'user')
        .map((p) => p.grantee_id)
      setSelectedTeamIds(teamIds)
      setSelectedUserIds(userIds)

      // If any permissions exist, entity is private
      setIsPrivate(perms.length > 0)
    } catch (err) {
      console.error('[EntityPermissionModal] Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [open, projectId, entityType, entityId])

  // Load data when modal opens
  useEffect(() => {
    loadData()
  }, [loadData])

  /**
   * Resolve user ID to display info.
   * @param userId - User UUID
   * @returns Object with name and email
   */
  const resolveUser = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    return {
      name: user?.displayName || userId,
      email: user?.email || '',
    }
  }

  /**
   * Resolve team ID to display name.
   * @param teamId - Team UUID
   * @returns Team name string
   */
  const resolveTeamName = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId)
    return team?.name || teamId
  }

  /**
   * Build all grantees (teams + users) for the table display.
   */
  const granteeTableData = useMemo(() => {
    const teamRows = selectedTeamIds.map((id) => ({
      key: `team-${id}`,
      type: 'team' as const,
      id,
      name: resolveTeamName(id),
      email: '',
    }))
    const userRows = selectedUserIds.map((id) => {
      const info = resolveUser(id)
      return {
        key: `user-${id}`,
        type: 'user' as const,
        id,
        name: info.name,
        email: info.email,
      }
    })
    return [...teamRows, ...userRows]
  }, [selectedTeamIds, selectedUserIds, teams, users])

  /**
   * Remove a grantee from the local selection (not yet saved to server).
   */
  const handleRemoveGrantee = (type: 'team' | 'user', id: string) => {
    if (type === 'team') {
      setSelectedTeamIds((prev) => prev.filter((tid) => tid !== id))
    } else {
      setSelectedUserIds((prev) => prev.filter((uid) => uid !== id))
    }
  }

  /**
   * Save all permission changes to the server.
   * Compares current selections with server state and applies diffs.
   */
  const handleSave = async () => {
    setSaving(true)
    try {
      // If not private, remove all existing permissions
      if (!isPrivate) {
        for (const perm of permissions) {
          await removeEntityPermission(projectId, perm.id)
        }
        message.success(t('projectManagement.entityPermissions.saved', 'Permissions saved'))
        onClose()
        return
      }

      // Determine diffs: added and removed grantees
      const existingTeamIds = new Set(
        permissions.filter((p) => p.grantee_type === 'team').map((p) => p.grantee_id),
      )
      const existingUserIds = new Set(
        permissions.filter((p) => p.grantee_type === 'user').map((p) => p.grantee_id),
      )

      // Teams to add
      const teamsToAdd = selectedTeamIds.filter((id) => !existingTeamIds.has(id))
      // Teams to remove
      const teamsToRemove = permissions.filter(
        (p) => p.grantee_type === 'team' && !selectedTeamIds.includes(p.grantee_id),
      )
      // Users to add
      const usersToAdd = selectedUserIds.filter((id) => !existingUserIds.has(id))
      // Users to remove
      const usersToRemove = permissions.filter(
        (p) => p.grantee_type === 'user' && !selectedUserIds.includes(p.grantee_id),
      )

      // Apply removals
      for (const perm of [...teamsToRemove, ...usersToRemove]) {
        await removeEntityPermission(projectId, perm.id)
      }

      // Apply additions (default permission level: 'view')
      for (const teamId of teamsToAdd) {
        await setEntityPermission(projectId, {
          entity_type: entityType,
          entity_id: entityId,
          grantee_type: 'team',
          grantee_id: teamId,
          permission_level: 'view',
        })
      }
      for (const userId of usersToAdd) {
        await setEntityPermission(projectId, {
          entity_type: entityType,
          entity_id: entityId,
          grantee_type: 'user',
          grantee_id: userId,
          permission_level: 'view',
        })
      }

      message.success(t('projectManagement.entityPermissions.saved', 'Permissions saved'))
      onClose()
    } catch (err) {
      console.error('[EntityPermissionModal] Failed to save:', err)
      message.error(t('projectManagement.entityPermissions.saveError', 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  /** Localized entity type label. */
  const entityTypeLabel = t(
    `projectManagement.entityPermissions.entityTypes.${entityType}`,
    entityType,
  )

  // Table columns for granted users/teams
  const columns = [
    {
      title: t('projectManagement.entityPermissions.name', 'Name'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: { type: string }) => (
        <div className="flex items-center gap-2">
          {record.type === 'team' ? (
            <Users size={14} className="text-purple-500 flex-shrink-0" />
          ) : (
            <User size={14} className="text-blue-500 flex-shrink-0" />
          )}
          <span>{name}</span>
        </div>
      ),
    },
    {
      title: t('projectManagement.entityPermissions.email', 'Email'),
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => (
        <span className="text-gray-500 dark:text-gray-400">{email || '—'}</span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      align: 'center' as const,
      render: (_: any, record: { type: 'team' | 'user'; id: string }) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<Trash2 size={14} />}
          onClick={() => handleRemoveGrantee(record.type, record.id)}
        />
      ),
    },
  ]

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('projectManagement.entityPermissions.editTitle', 'Edit Permissions')}
      width={640}
      footer={
        <div className="flex justify-end gap-2">
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
      <div className="space-y-5 py-2">
        {/* Entity info banner */}
        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{entityName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {entityTypeLabel}
          </p>
        </div>

        {/* Permissions section */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('projectManagement.entityPermissions.permissions', 'Permissions')}
          </h4>

          {/* Private Access toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <Lock size={18} className="text-amber-500" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t('projectManagement.entityPermissions.privateAccess', 'Private Access')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t(
                    'projectManagement.entityPermissions.privateAccessDesc',
                    'Only selected teams or users can access this {{type}}',
                    { type: entityTypeLabel },
                  )}
                </p>
              </div>
            </div>
            <Switch
              checked={isPrivate}
              onChange={setIsPrivate}
            />
          </div>
        </div>

        {/* Team/User selection — only shown when Private Access is enabled */}
        {isPrivate && (
          <>
            <Divider className="my-2" />

            {/* Select Teams */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Users size={14} />
                {t('projectManagement.entityPermissions.selectTeams', 'Select Teams')}
              </label>
              <Select
                mode="multiple"
                value={selectedTeamIds}
                onChange={setSelectedTeamIds}
                placeholder={t(
                  'projectManagement.entityPermissions.selectTeamsPlaceholder',
                  'Select teams allowed to access this source',
                )}
                className="w-full"
                optionFilterProp="label"
                loading={loading}
                options={teams.map((team) => ({
                  label: team.name,
                  value: team.id,
                }))}
              />
            </div>

            {/* Select Users */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <User size={14} />
                {t('projectManagement.entityPermissions.selectUsers', 'Select Users')}
              </label>
              <Select
                mode="multiple"
                value={selectedUserIds}
                onChange={setSelectedUserIds}
                placeholder={t(
                  'projectManagement.entityPermissions.selectUsersPlaceholder',
                  'Select users allowed to access this source',
                )}
                className="w-full"
                optionFilterProp="label"
                loading={loading}
                options={users.map((user) => ({
                  label: `${user.displayName} (${user.email})`,
                  value: user.id,
                }))}
              />
            </div>

            {/* Grantee table */}
            {granteeTableData.length > 0 && (
              <Table
                dataSource={granteeTableData}
                columns={columns}
                rowKey="key"
                size="small"
                pagination={false}
                className="border rounded-lg dark:border-slate-700 overflow-hidden"
              />
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
