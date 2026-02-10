/**
 * @fileoverview Documents tab content for the project detail page.
 *
 * Layout: category sidebar (left) + version panel (right).
 * The version panel shows version chips, a document list, and an upload area.
 * Owns all category/version state and CRUD handlers.
 *
 * @module features/projects/components/DocumentsTab
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Tag, Popconfirm, Form, Tooltip, message } from 'antd'
import { Plus, Trash2, Pencil, Archive, FolderOpen } from 'lucide-react'
import {
  getDocumentCategories,
  createDocumentCategory,
  deleteDocumentCategory,
  getCategoryVersions,
  createCategoryVersion,
  deleteCategoryVersion,
  archiveCategoryVersion,
  type DocumentCategory,
  type DocumentCategoryVersion,
} from '../api/projectService'
import CategoryModal from './CategoryModal'
import VersionModal from './VersionModal'
import EditVersionModal from './EditVersionModal'
import DocumentListPanel from './DocumentListPanel'

// ============================================================================
// Types
// ============================================================================

interface DocumentsTabProps {
  /** Current project ID */
  projectId: string
  /** Initial category list fetched by the parent */
  initialCategories: DocumentCategory[]
}

// ============================================================================
// Component
// ============================================================================

/**
 * Documents tab — category sidebar + version panel with document list.
 *
 * @param {DocumentsTabProps} props - Component props
 * @returns {JSX.Element} The rendered documents tab content
 */
const DocumentsTab = ({ projectId, initialCategories }: DocumentsTabProps) => {
  const { t } = useTranslation()

  // ── State ──────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<DocumentCategory[]>(initialCategories)
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | null>(null)
  const [versions, setVersions] = useState<DocumentCategoryVersion[]>([])
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [categoryForm] = Form.useForm()
  const [versionModalOpen, setVersionModalOpen] = useState(false)
  const [versionForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [loadingVersions, setLoadingVersions] = useState(false)

  // Edit version modal state
  const [editVersionModalOpen, setEditVersionModalOpen] = useState(false)
  const [editingVersion, setEditingVersion] = useState<DocumentCategoryVersion | null>(null)

  // Track selected version for upload area + document list
  const [selectedVersion, setSelectedVersion] = useState<DocumentCategoryVersion | null>(null)



  // Sync with parent if initialCategories changes
  useEffect(() => {
    setCategories(initialCategories)
  }, [initialCategories])

  // Fetch versions when a category is selected
  useEffect(() => {
    if (!selectedCategory) {
      setVersions([])
      setSelectedVersion(null)
      return
    }
    setLoadingVersions(true)
    getCategoryVersions(projectId, selectedCategory.id)
      .then((data) => {
        setVersions(data)
        // Auto-select first active version
        const active = data.find((v) => v.status === 'active') || data[0]
        setSelectedVersion(active || null)
      })
      .catch((err: unknown) => {
        console.error('Failed to load versions:', err)
        message.error(String(err))
      })
      .finally(() => setLoadingVersions(false))
  }, [projectId, selectedCategory])

  // ── Handlers ───────────────────────────────────────────────────────────

  /** Refresh versions for the currently selected category */
  const refreshVersions = async () => {
    if (!selectedCategory) return
    setLoadingVersions(true)
    try {
      const verData = await getCategoryVersions(projectId, selectedCategory.id)
      setVersions(verData)
    } finally {
      setLoadingVersions(false)
    }
  }



  /** Create a new category */
  const handleCreateCategory = async () => {
    try {
      const values = await categoryForm.validateFields()
      setSaving(true)
      await createDocumentCategory(projectId, values)
      setCategoryModalOpen(false)
      categoryForm.resetFields()
      const catData = await getDocumentCategories(projectId)
      setCategories(catData)
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  /** Delete a category */
  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await deleteDocumentCategory(projectId, categoryId)
      const catData = await getDocumentCategories(projectId)
      setCategories(catData)
      if (selectedCategory?.id === categoryId) {
        setSelectedCategory(null)
      }
    } catch (err) {
      message.error(String(err))
    }
  }

  /** Delete a version */
  const handleDeleteVersion = async (versionId: string) => {
    if (!selectedCategory) return
    try {
      await deleteCategoryVersion(projectId, selectedCategory.id, versionId)
      if (selectedVersion?.id === versionId) setSelectedVersion(null)
      await refreshVersions()
    } catch (err) {
      message.error(String(err))
    }
  }

  /** Deactivate (archive) a version */
  const handleDeactivateVersion = async (versionId: string) => {
    if (!selectedCategory) return
    try {
      await archiveCategoryVersion(projectId, selectedCategory.id, versionId)
      message.success(t('projectManagement.versions.deactivateSuccess'))
      if (selectedVersion?.id === versionId) setSelectedVersion(null)
      await refreshVersions()
    } catch (err) {
      message.error(String(err))
    }
  }

  /** Open edit version modal */
  const handleOpenEditVersion = (version: DocumentCategoryVersion) => {
    setEditingVersion(version)
    setEditVersionModalOpen(true)
  }

  /** Open version creation modal */
  const handleCreateVersion = () => {
    versionForm.resetFields()
    setVersionModalOpen(true)
  }

  /** Submit version creation with duplicate check */
  const handleSubmitVersion = async () => {
    if (!selectedCategory) return
    try {
      const values = await versionForm.validateFields()
      const version_label = values.version_label.trim()

      const duplicate = versions.find(
        (v) => v.version_label.toLowerCase() === version_label.toLowerCase()
      )
      if (duplicate) {
        message.error(t('projectManagement.versions.duplicateError'))
        return
      }

      setSaving(true)
      await createCategoryVersion(projectId, selectedCategory.id, { version_label })
      setVersionModalOpen(false)
      versionForm.resetFields()
      await refreshVersions()
      message.success(t('projectManagement.versions.syncSuccess'))
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  /** Color for version status */
  const statusColor = (status: string) => {
    const map: Record<string, string> = { active: 'green', synced: 'blue', archived: 'default' }
    return map[status] || 'default'
  }

  return (
    <>
      <div className="flex gap-6" style={{ minHeight: 400 }}>
        {/* ── Category sidebar ──────────────────────────────────────── */}
        <div className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-700 pr-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('projectManagement.categories.title')}
            </h3>
            <Button size="small" type="text" icon={<Plus size={14} />} onClick={() => setCategoryModalOpen(true)} />
          </div>
          {categories.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">{t('projectManagement.categories.noCategoriesHint')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat)}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-all duration-150 border-l-3
                    ${selectedCategory?.id === cat.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold border-l-blue-500 shadow-sm'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 border-l-transparent hover:border-l-gray-300 dark:hover:border-l-slate-500'
                    }`}
                >
                  <span className="truncate">{cat.name}</span>
                  <Popconfirm
                    title={t('projectManagement.categories.deleteConfirm')}
                    onConfirm={(e?: React.MouseEvent) => { e?.stopPropagation(); handleDeleteCategory(cat.id) }}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<Trash2 size={12} />}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100"
                    />
                  </Popconfirm>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right panel: Versions + Documents ─────────────────────── */}
        <div className="flex-1 min-w-0">
          {selectedCategory ? (
            <div className="flex flex-col gap-4">
              {/* Version header + add button */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t('projectManagement.versions.title')} — {selectedCategory.name}
                </h3>
                <Button type="primary" size="small" icon={<Plus size={14} />} onClick={handleCreateVersion}>
                  {t('projectManagement.versions.add')}
                </Button>
              </div>

              {/* Version chips/cards — horizontal scrollable */}
              {loadingVersions ? (
                <div className="flex gap-2">
                  {[1, 2, 3].map((k) => (
                    <div key={k} className="h-16 w-40 bg-gray-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {t('projectManagement.versions.noVersionsHint')}
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {versions.map((ver) => (
                    <div
                      key={ver.id}
                      onClick={() => setSelectedVersion(ver)}
                      className={`group relative flex flex-col gap-1 px-4 py-2.5 rounded-lg cursor-pointer border transition-all text-sm min-w-[140px]
                        ${selectedVersion?.id === ver.id
                          ? 'border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-slate-800'
                        }`}
                    >
                      {/* Version label + status */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                          {ver.version_label}
                        </span>
                        <Tag color={statusColor(ver.status)} className="text-xs m-0">
                          {t(`projectManagement.versions.status.${ver.status}`)}
                        </Tag>
                      </div>

                      {/* Action buttons — visible on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip title={t('projectManagement.versions.editLabel')}>
                          <Button
                            type="text"
                            size="small"
                            icon={<Pencil size={12} />}
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleOpenEditVersion(ver) }}
                          />
                        </Tooltip>
                        {ver.status !== 'archived' && (
                          <Popconfirm
                            title={t('projectManagement.versions.deactivateConfirm')}
                            onConfirm={() => handleDeactivateVersion(ver.id)}
                          >
                            <Tooltip title={t('projectManagement.versions.deactivate')}>
                              <Button
                                type="text"
                                size="small"
                                icon={<Archive size={12} />}
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              />
                            </Tooltip>
                          </Popconfirm>
                        )}
                        <Popconfirm
                          title={t('projectManagement.versions.deleteConfirm')}
                          onConfirm={() => handleDeleteVersion(ver.id)}
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<Trash2 size={12} />}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          />
                        </Popconfirm>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected version content: document list with upload modals */}
              {selectedVersion && selectedCategory && (
                <>
                  <DocumentListPanel
                    projectId={projectId}
                    categoryId={selectedCategory.id}
                    versionId={selectedVersion.id}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 gap-2">
              <FolderOpen size={40} className="text-gray-300" />
              <p className="text-sm">{t('projectManagement.categories.noCategoriesHint')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CategoryModal
        open={categoryModalOpen}
        form={categoryForm}
        saving={saving}
        onOk={handleCreateCategory}
        onCancel={() => setCategoryModalOpen(false)}
      />
      <VersionModal
        open={versionModalOpen}
        form={versionForm}
        saving={saving}
        onOk={handleSubmitVersion}
        onCancel={() => setVersionModalOpen(false)}
      />
      <EditVersionModal
        open={editVersionModalOpen}
        version={editingVersion}
        projectId={projectId}
        categoryId={selectedCategory?.id || ''}
        saving={saving}
        onSavingChange={setSaving}
        onSaved={() => {
          setEditVersionModalOpen(false)
          refreshVersions()
        }}
        onCancel={() => setEditVersionModalOpen(false)}
      />
    </>
  )
}

export default DocumentsTab
