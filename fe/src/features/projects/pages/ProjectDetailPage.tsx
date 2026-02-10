/**
 * @fileoverview Project detail page with tabbed interface.
 *
 * Features:
 * - Header with project name, server badge, and back button
 * - Three tabs: Documents, Chat, Settings
 * - Dark/light theme support
 * - Full i18n support
 *
 * @module features/projects/pages/ProjectDetailPage
 */

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { Tabs, Button, Tag, Spin, Empty, message } from 'antd'
import { ArrowLeft, FolderOpen, MessageSquare, Settings } from 'lucide-react'
import {
  getProjectById,
  getDocumentCategories,
  getProjectChats,
  getProjectPermissions,
  type Project,
  type DocumentCategory,
  type ProjectChat,
  type ProjectPermission,
} from '../api/projectService'
import DocumentsTab from '../components/DocumentsTab'
import ChatTab from '../components/ChatTab'
import SettingsTab from '../components/SettingsTab'

// ============================================================================
// Component
// ============================================================================

/**
 * Project detail page with tabs for Documents, Chat, and Settings.
 *
 * Loaded via /projects/:projectId route.
 */
const ProjectDetailPage = () => {
  const { t } = useTranslation()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  // Project data
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // Sub-resource data passed to tab components
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [chats, setChats] = useState<ProjectChat[]>([])
  const [permissions, setPermissions] = useState<ProjectPermission[]>([])

  /**
   * Fetch the project and its sub-resources.
   */
  const fetchProject = useCallback(async () => {
    if (!projectId) return
    try {
      setLoading(true)
      const [projectData, categoryData, chatData, permData] = await Promise.all([
        getProjectById(projectId),
        getDocumentCategories(projectId),
        getProjectChats(projectId),
        getProjectPermissions(projectId),
      ])
      setProject(projectData)
      setCategories(categoryData)
      setChats(chatData)
      setPermissions(permData)
    } catch (err) {
      console.error('Failed to load project:', err)
      message.error(String(err))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  /** Effect: Load project on mount */
  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Empty description="Project not found" />
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div>
          {/* Back + title */}
          <div className="mb-6">
            <Button
              type="text"
              icon={<ArrowLeft size={16} />}
              onClick={() => navigate('/knowledge-base/projects')}
              className="mb-2"
            >
              {t('projectManagement.title')}
            </Button>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
                <Tag color={project.status === 'active' ? 'green' : 'default'}>{project.status}</Tag>
              </div>
              {project.description && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">{project.description}</p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            defaultActiveKey="documents"
            items={[
              {
                key: 'documents',
                label: (
                  <span className="flex items-center gap-2">
                    <FolderOpen size={16} />
                    {t('projectManagement.tabs.documents')}
                  </span>
                ),
                children: (
                  <DocumentsTab
                    projectId={projectId!}
                    initialCategories={categories}
                  />
                ),
              },
              {
                key: 'chat',
                label: (
                  <span className="flex items-center gap-2">
                    <MessageSquare size={16} />
                    {t('projectManagement.tabs.chat')}
                  </span>
                ),
                children: (
                  <ChatTab
                    projectId={projectId!}
                    initialChats={chats}
                  />
                ),
              },
              {
                key: 'settings',
                label: (
                  <span className="flex items-center gap-2">
                    <Settings size={16} />
                    {t('projectManagement.tabs.settings')}
                  </span>
                ),
                children: (
                  <SettingsTab
                    projectId={projectId!}
                    permissions={permissions}
                    onPermissionRemoved={fetchProject}
                  />
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

export default ProjectDetailPage
