/**
 * @fileoverview Settings tab content for the project detail page.
 *
 * Displays the permissions table with delete actions.
 *
 * @module features/projects/components/SettingsTab
 */

import { useTranslation } from 'react-i18next'
import { Button, Table, Tag, Popconfirm, Card } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Trash2 } from 'lucide-react'
import {
  removeProjectPermission,
  type ProjectPermission,
} from '../api/projectService'

// ============================================================================
// Types
// ============================================================================

interface SettingsTabProps {
  /** Current project ID */
  projectId: string
  /** List of project permissions */
  permissions: ProjectPermission[]
  /** Callback when a permission is removed so the parent can refetch */
  onPermissionRemoved: () => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * Settings tab — project permissions table.
 *
 * @param {SettingsTabProps} props - Component props
 * @returns {JSX.Element} The rendered settings tab content
 */
const SettingsTab = ({ projectId, permissions, onPermissionRemoved }: SettingsTabProps) => {
  const { t } = useTranslation()

  // ── Table columns ──────────────────────────────────────────────────────

  /** Permission table columns */
  const permissionColumns: ColumnsType<ProjectPermission> = [
    { title: t('projectManagement.permissions.granteeType'), dataIndex: 'grantee_type', key: 'grantee_type' },
    { title: t('projectManagement.permissions.grantee'), dataIndex: 'grantee_id', key: 'grantee_id', ellipsis: true },
    {
      title: t('projectManagement.permissions.tabDocuments'),
      dataIndex: 'tab_documents',
      key: 'tab_documents',
      render: (v: string) => <Tag>{t(`projectManagement.permissions.levels.${v}`)}</Tag>,
    },
    {
      title: t('projectManagement.permissions.tabChat'),
      dataIndex: 'tab_chat',
      key: 'tab_chat',
      render: (v: string) => <Tag>{t(`projectManagement.permissions.levels.${v}`)}</Tag>,
    },
    {
      title: t('projectManagement.permissions.tabSettings'),
      dataIndex: 'tab_settings',
      key: 'tab_settings',
      render: (v: string) => <Tag>{t(`projectManagement.permissions.levels.${v}`)}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: unknown, record: ProjectPermission) => (
        <Popconfirm
          title={t('projectManagement.permissions.deleteConfirm')}
          onConfirm={() => removeProjectPermission(projectId, record.id).then(() => onPermissionRemoved())}
        >
          <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
        </Popconfirm>
      ),
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Card title={t('projectManagement.permissions.title')} size="small">
        <Table
          rowKey="id"
          columns={permissionColumns}
          dataSource={permissions}
          size="small"
          pagination={false}
          locale={{ emptyText: t('projectManagement.permissions.noPermissions') }}
        />
      </Card>
    </div>
  )
}

export default SettingsTab
