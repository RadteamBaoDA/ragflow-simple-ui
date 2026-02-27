/**
 * EntityPermissionModal: Reusable modal for managing per-entity permissions.
 * Opens from a lock icon on each category/chat/search row.
 *
 * @description Displays permission grantees table with Select for level,
 * supports adding users/teams, removing grantees, and auto-saves via API.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Select, Table, Popconfirm, Tag, message } from 'antd'
import { Users, User, Trash2, Plus } from 'lucide-react'
import { Dialog } from '@/components/Dialog'
import { teamApi, type Team } from '@/features/teams'
import { userApi } from '@/features/users'
import { User as UserType } from '@/features/auth'
import {
  type ProjectEntityPermission,
  getEntityPermissionsByEntity,
  setEntityPermission,
  removeEntityPermission,
} from '../api/projectService'

/** Permission level hierarchy for display labels and ordering. */
const PERMISSION_LEVELS = [
  { value: 'view', label: 'View', color: 'blue' },
  { value: 'create', label: 'Create', color: 'cyan' },
  { value: 'edit', label: 'Edit', color: 'orange' },
  { value: 'delete', label: 'Delete', color: 'red' },
] as const

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

/**
 * EntityPermissionModal component.
 * Manages per-entity permission grantees with hierarchical level selection.
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

  // Add form state
  const [addGranteeType, setAddGranteeType] = useState<'user' | 'team'>('user')
  const [addGranteeId, setAddGranteeId] = useState<string | undefined>(undefined)
  const [addLevel, setAddLevel] = useState<string>('view')
  const [saving, setSaving] = useState(false)

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
   * Add or update a grantee's permission for this entity.
   */
  const handleAddPermission = async () => {
    if (!addGranteeId) return
    setSaving(true)
    try {
      await setEntityPermission(projectId, {
        entity_type: entityType,
        entity_id: entityId,
        grantee_type: addGranteeType,
        grantee_id: addGranteeId,
        permission_level: addLevel,
      })
      message.success(t('projectManagement.entityPermissions.saved', 'Permission saved'))
      // Reset form and reload
      setAddGranteeId(undefined)
      setAddLevel('view')
      await loadData()
    } catch (err) {
      console.error('[EntityPermissionModal] Failed to set permission:', err)
      message.error(t('projectManagement.entityPermissions.saveError', 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  /**
   * Update an existing grantee's permission level inline.
   */
  const handleUpdateLevel = async (permId: string, newLevel: string) => {
    // Find the existing record to get entity/grantee info
    const existing = permissions.find((p) => p.id === permId)
    if (!existing) return
    try {
      await setEntityPermission(projectId, {
        entity_type: entityType,
        entity_id: entityId,
        grantee_type: existing.grantee_type,
        grantee_id: existing.grantee_id,
        permission_level: newLevel,
      })
      message.success(t('projectManagement.entityPermissions.saved', 'Permission saved'))
      await loadData()
    } catch (err) {
      console.error('[EntityPermissionModal] Failed to update permission:', err)
      message.error(t('projectManagement.entityPermissions.saveError', 'Failed to save'))
    }
  }

  /**
   * Remove a grantee's permission.
   */
  const handleRemove = async (permId: string) => {
    try {
      await removeEntityPermission(projectId, permId)
      message.success(t('projectManagement.entityPermissions.removed', 'Permission removed'))
      await loadData()
    } catch (err) {
      console.error('[EntityPermissionModal] Failed to remove permission:', err)
      message.error(t('projectManagement.entityPermissions.removeError', 'Failed to remove'))
    }
  }

  /**
   * Resolve a grantee ID to a display name.
   */
  const resolveGranteeName = (type: string, id: string): string => {
    if (type === 'user') {
      const user = users.find((u) => u.id === id)
      return user ? `${user.displayName} (${user.email})` : id
    }
    const team = teams.find((t) => t.id === id)
    return team ? team.name : id
  }

  /** Build options for grantee select, excluding already-assigned grantees. */
  const granteeOptions = (() => {
    // Get already-assigned grantee IDs of the selected type
    const assignedIds = new Set(
      permissions
        .filter((p) => p.grantee_type === addGranteeType)
        .map((p) => p.grantee_id),
    )
    if (addGranteeType === 'user') {
      return users
        .filter((u) => !assignedIds.has(u.id))
        .map((u) => ({ label: `${u.displayName} (${u.email})`, value: u.id }))
    }
    return teams
      .filter((t) => !assignedIds.has(t.id))
      .map((t) => ({ label: t.name, value: t.id }))
  })()

  /** Localized entity type label. */
  const entityTypeLabel = t(
    `projectManagement.entityPermissions.entityTypes.${entityType}`,
    entityType,
  )

  // Table columns for existing permissions
  const columns = [
    {
      title: t('projectManagement.entityPermissions.granteeType', 'Type'),
      dataIndex: 'grantee_type',
      key: 'grantee_type',
      width: 80,
      render: (type: string) => (
        <Tag
          icon={type === 'user' ? <User size={10} /> : <Users size={10} />}
          color={type === 'user' ? 'blue' : 'purple'}
          className="flex items-center gap-1 w-fit"
        >
          {type === 'user'
            ? t('projectManagement.entityPermissions.user', 'User')
            : t('projectManagement.entityPermissions.team', 'Team')}
        </Tag>
      ),
    },
    {
      title: t('projectManagement.entityPermissions.grantee', 'Grantee'),
      key: 'grantee_name',
      render: (_: any, record: ProjectEntityPermission) =>
        resolveGranteeName(record.grantee_type, record.grantee_id),
    },
    {
      title: t('projectManagement.entityPermissions.level', 'Level'),
      dataIndex: 'permission_level',
      key: 'permission_level',
      width: 140,
      render: (level: string, record: ProjectEntityPermission) => (
        <Select
          value={level}
          size="small"
          style={{ width: 120 }}
          onChange={(val: string) => handleUpdateLevel(record.id, val)}
          options={PERMISSION_LEVELS.map((l) => ({
            label: t(`projectManagement.entityPermissions.levels.${l.value}`, l.label),
            value: l.value,
          }))}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      align: 'center' as const,
      render: (_: any, record: ProjectEntityPermission) => (
        <Popconfirm
          title={t('projectManagement.entityPermissions.removeConfirm', 'Remove this permission?')}
          onConfirm={() => handleRemove(record.id)}
        >
          <Button type="text" danger size="small" icon={<Trash2 size={14} />} />
        </Popconfirm>
      ),
    },
  ]

  if (!open) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${t('projectManagement.entityPermissions.title', 'Permissions')}: ${entityName}`}
      maxWidth="none"
      className="w-[50vw]"
    >
      <div className="space-y-5">
        {/* Entity info banner */}
        <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('projectManagement.entityPermissions.description', 'Manage who can access this {{type}}', { type: entityTypeLabel })}
          </p>
        </div>

        {/* Add grantee form */}
        <div className="flex items-end gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex-shrink-0">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
              {t('projectManagement.entityPermissions.granteeType', 'Type')}
            </label>
            <Select
              value={addGranteeType}
              onChange={(v: 'user' | 'team') => {
                setAddGranteeType(v)
                setAddGranteeId(undefined)
              }}
              size="small"
              style={{ width: 100 }}
              options={[
                { label: t('projectManagement.entityPermissions.user', 'User'), value: 'user' },
                { label: t('projectManagement.entityPermissions.team', 'Team'), value: 'team' },
              ]}
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
              {t('projectManagement.entityPermissions.grantee', 'Grantee')}
            </label>
            <Select
              showSearch
              value={addGranteeId}
              onChange={setAddGranteeId}
              placeholder={t('projectManagement.entityPermissions.selectGrantee', 'Select...')}
              size="small"
              className="w-full"
              optionFilterProp="label"
              options={granteeOptions}
              loading={loading}
            />
          </div>
          <div className="flex-shrink-0">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
              {t('projectManagement.entityPermissions.level', 'Level')}
            </label>
            <Select
              value={addLevel}
              onChange={setAddLevel}
              size="small"
              style={{ width: 110 }}
              options={PERMISSION_LEVELS.map((l) => ({
                label: t(`projectManagement.entityPermissions.levels.${l.value}`, l.label),
                value: l.value,
              }))}
            />
          </div>
          <Button
            type="primary"
            size="small"
            icon={<Plus size={14} />}
            onClick={handleAddPermission}
            disabled={!addGranteeId}
            loading={saving}
          >
            {t('projectManagement.entityPermissions.add', 'Add')}
          </Button>
        </div>

        {/* Existing permissions table */}
        <Table
          dataSource={permissions}
          columns={columns}
          rowKey="id"
          size="small"
          loading={loading}
          pagination={false}
          locale={{
            emptyText: t('projectManagement.entityPermissions.noPermissions', 'No permissions configured'),
          }}
          className="border rounded-lg dark:border-slate-700 overflow-hidden"
        />

        {/* Close button */}
        <div className="flex justify-end pt-2 border-t dark:border-gray-700">
          <Button onClick={onClose}>
            {t('common.close', 'Close')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
