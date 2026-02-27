/**
 * @fileoverview Search tab content for the project detail page.
 *
 * Displays the AI Search app list with add/edit/delete/sync actions.
 * Resolves category selections into ragflow_dataset_ids on search creation/update.
 *
 * @module features/projects/components/SearchTab
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Table, Popconfirm, Form, message, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Trash2, RefreshCw, Pencil, Lock } from 'lucide-react'
import {
  getProjectSearches,
  createProjectSearch,
  updateProjectSearch,
  deleteProjectSearch,
  syncProjectSearch,
  type ProjectSearch,
  type DocumentCategory,
  type DocumentCategoryVersion,
} from '../api/projectService'
import SearchModal from './SearchModal'
import { EntityPermissionModal } from './EntityPermissionModal'

// ============================================================================
// Types
// ============================================================================

interface SearchTabProps {
  /** Current project ID */
  projectId: string
  /** Initial search list fetched by the parent */
  initialSearches: ProjectSearch[]
  /** Project document categories */
  categories: DocumentCategory[]
  /** Map of category ID → its versions (pre-fetched by parent) */
  categoryVersions: Record<string, DocumentCategoryVersion[]>
  /** Available chat models from the RAGFlow server config */
  chatModels: string[]
}

// ============================================================================
// Component
// ============================================================================

/**
 * Search tab — AI Search app list with CRUD.
 * Resolves selected categories → ragflow_dataset_ids on creation/update.
 */
const SearchTab = ({
  projectId,
  initialSearches,
  categories,
  categoryVersions,
  chatModels,
}: SearchTabProps) => {
  const { t } = useTranslation()
  const [form] = Form.useForm()

  // List state
  const [searches, setSearches] = useState<ProjectSearch[]>(initialSearches)
  const [loading, setLoading] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingSearch, setEditingSearch] = useState<ProjectSearch | null>(null)
  const [saving, setSaving] = useState(false)
  const [permSearchId, setPermSearchId] = useState<string | null>(null)
  const [permSearchName, setPermSearchName] = useState('')

  // Sync initial data
  useEffect(() => {
    setSearches(initialSearches)
  }, [initialSearches])

  /**
   * Refresh searches list from API.
   */
  const refreshSearches = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getProjectSearches(projectId)
      setSearches(data)
    } catch (err) {
      message.error(t('projectManagement.searches.fetchError', 'Failed to fetch search apps'))
    } finally {
      setLoading(false)
    }
  }, [projectId, t])

  /**
   * Resolve selected category IDs → ragflow_dataset_ids.
   * Collects all active versions' ragflow_dataset_id for the selected categories.
   */
  const resolveRagflowDatasetIds = useCallback(
    (selectedCategoryIds: string[]): string[] => {
      const ids: string[] = []
      for (const catId of selectedCategoryIds) {
        const versions = categoryVersions[catId] || []
        for (const v of versions) {
          if (v.ragflow_dataset_id) {
            ids.push(v.ragflow_dataset_id)
          }
        }
      }
      return ids
    },
    [categoryVersions],
  )

  /**
   * Open create modal.
   */
  const handleAdd = useCallback(() => {
    setIsEditing(false)
    setEditingSearch(null)
    form.resetFields()
    setModalOpen(true)
  }, [form])

  /**
   * Open edit modal.
   */
  const handleEdit = useCallback(
    (record: ProjectSearch) => {
      setIsEditing(true)
      setEditingSearch(record)
      setModalOpen(true)
    },
    [],
  )

  /**
   * Delete a search app.
   */
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteProjectSearch(projectId, id)
        message.success(t('projectManagement.searches.deleteSuccess', 'Search app deleted'))
        refreshSearches()
      } catch {
        message.error(t('projectManagement.searches.deleteError', 'Failed to delete search app'))
      }
    },
    [projectId, refreshSearches, t],
  )

  /**
   * Sync a search from RAGFlow.
   */
  const handleSync = useCallback(
    async (id: string) => {
      try {
        await syncProjectSearch(projectId, id)
        message.success(t('projectManagement.searches.syncSuccess', 'Search app synced'))
        refreshSearches()
      } catch {
        message.error(t('projectManagement.searches.syncError', 'Failed to sync search app'))
      }
    },
    [projectId, refreshSearches, t],
  )

  /**
   * Save handler for create/update.
   */
  const handleSave = useCallback(
    async (values: any) => {
      try {
        setSaving(true)
        const selectedCategoryIds: string[] = values.dataset_ids || []
        const ragflowDatasetIds = resolveRagflowDatasetIds(selectedCategoryIds)

        const payload = {
          name: values.name,
          description: values.description,
          dataset_ids: selectedCategoryIds,
          ragflow_dataset_ids: ragflowDatasetIds,
          search_config: values.search_config || {},
        }

        if (isEditing && editingSearch) {
          await updateProjectSearch(projectId, editingSearch.id, payload)
          message.success(t('projectManagement.searches.updateSuccess', 'Search app updated'))
        } else {
          await createProjectSearch(projectId, payload)
          message.success(t('projectManagement.searches.createSuccess', 'Search app created'))
        }

        setModalOpen(false)
        refreshSearches()
      } catch (err: any) {
        message.error(err.message || t('projectManagement.searches.saveError', 'Failed to save search app'))
      } finally {
        setSaving(false)
      }
    },
    [isEditing, editingSearch, projectId, resolveRagflowDatasetIds, refreshSearches, t],
  )

  /**
   * Resolve dataset_ids (category IDs) to category names for display.
   */
  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {}
    categories.forEach((c) => { map[c.id] = c.name })
    return map
  }, [categories])

  // ── Table columns ────────────────────────────────────────────────────

  const columns: ColumnsType<ProjectSearch> = useMemo(
    () => [
      {
        title: t('projectManagement.searches.name', 'Name'),
        dataIndex: 'name',
        key: 'name',
        width: '25%',
      },
      {
        title: t('projectManagement.searches.description', 'Description'),
        dataIndex: 'description',
        key: 'description',
        width: '25%',
        render: (val: string | null) => val || '—',
      },
      {
        title: t('projectManagement.searches.datasets', 'Datasets'),
        dataIndex: 'dataset_ids',
        key: 'datasets',
        width: '25%',
        render: (ids: string[]) =>
          ids && ids.length > 0
            ? ids.map((id) => (
                <Tag key={id} color="blue" style={{ marginBottom: 2 }}>
                  {categoryMap[id] || id}
                </Tag>
              ))
            : '—',
      },
      {
        title: t('projectManagement.searches.ragflowId', 'RAGFlow ID'),
        dataIndex: 'ragflow_search_id',
        key: 'ragflow_search_id',
        width: '10%',
        render: (val: string | null) =>
          val ? (
            <Tag color="cyan" style={{ fontSize: 11 }}>
              {val.substring(0, 8)}…
            </Tag>
          ) : (
            '—'
          ),
      },
      {
        title: t('projectManagement.searches.actions', 'Actions'),
        key: 'actions',
        width: '15%',
        render: (_: unknown, record: ProjectSearch) => (
          <div className="flex items-center gap-1">
            <Button
              type="text"
              size="small"
              icon={<Lock size={14} />}
              onClick={() => { setPermSearchId(record.id); setPermSearchName(record.name) }}
              title={t('projectManagement.entityPermissions.title', 'Permissions')}
            />
            <Button
              type="text"
              size="small"
              icon={<Pencil size={14} />}
              onClick={() => handleEdit(record)}
              title={t('projectManagement.searches.edit', 'Edit')}
            />
            <Button
              type="text"
              size="small"
              icon={<RefreshCw size={14} />}
              onClick={() => handleSync(record.id)}
              title={t('projectManagement.searches.sync', 'Sync')}
              disabled={!record.ragflow_search_id}
            />
            <Popconfirm
              title={t('projectManagement.searches.deleteConfirm', 'Delete this search app?')}
              onConfirm={() => handleDelete(record.id)}
              okText={t('common.yes', 'Yes')}
              cancelText={t('common.no', 'No')}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 size={14} />}
                title={t('projectManagement.searches.delete', 'Delete')}
              />
            </Popconfirm>
          </div>
        ),
      },
    ],
    [t, categoryMap, handleEdit, handleSync, handleDelete],
  )

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="flex justify-end mb-4">
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={handleAdd}
        >
          {t('projectManagement.searches.addSearch', 'Add Search')}
        </Button>
      </div>

      {/* Table */}
      <Table
        dataSource={searches}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{
          emptyText: t('projectManagement.searches.noSearches', 'No search apps yet. Click "Add Search" to create one.'),
        }}
      />

      {/* Create/Edit Modal */}
      <SearchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={refreshSearches}
        form={form}
        isEditing={isEditing}
        editingSearch={editingSearch}
        categories={categories}
        categoryVersions={categoryVersions}
        chatModels={chatModels}
        onSave={handleSave}
        saving={saving}
      />
      {permSearchId && (
        <EntityPermissionModal
          open={!!permSearchId}
          onClose={() => setPermSearchId(null)}
          projectId={projectId}
          entityType="search"
          entityId={permSearchId}
          entityName={permSearchName}
        />
      )}
    </>
  )
}

export default SearchTab
