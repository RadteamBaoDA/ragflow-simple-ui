/**
 * @fileoverview Project list page with CRUD operations.
 *
 * Features:
 * - Card grid listing all projects
 * - Create/edit project modal
 * - Delete project with confirmation
 * - Server badge and status indicator
 * - Navigation to project detail
 * - Dark/light theme support
 * - Full i18n support
 *
 * @module features/projects/pages/ProjectListPage
 */

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  Modal,
  Form,
  Input,
  Select as AntSelect,
  Space,
  Tag,
  Tooltip,
  Popconfirm,
  message,
  Spin,
  Empty,
} from 'antd'
import {
  Plus,
  FolderOpen,
  Pencil,
  Trash2,
} from 'lucide-react'
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  type Project,
} from '../api/projectService'
import { getRagflowServers, type RagflowServer } from '@/features/ragflow-servers'

// ============================================================================
// Component
// ============================================================================

/**
 * Project list page showing all projects as cards.
 *
 * Users can create, edit, and delete projects here.
 * Clicking a project card navigates to the project detail page.
 */
const ProjectListPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  // Data state
  const [projects, setProjects] = useState<Project[]>([])
  const [servers, setServers] = useState<RagflowServer[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [saving, setSaving] = useState(false)

  /**
   * Fetch all projects and servers from the API.
   */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [projectData, serverData] = await Promise.all([
        getProjects(),
        getRagflowServers(),
      ])
      setProjects(projectData)
      setServers(serverData)
    } catch (err) {
      console.error('Failed to fetch data:', err)
      message.error(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  /** Effect: Load data on mount */
  useEffect(() => {
    fetchData()
  }, [fetchData])

  /**
   * Open modal to create a new project.
   */
  const handleAdd = () => {
    setEditingProject(null)
    form.resetFields()
    setModalOpen(true)
  }

  /**
   * Open modal to edit an existing project.
   *
   * @param project - The project to edit
   * @param e - Mouse event (stopped to prevent card click)
   */
  const handleEdit = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingProject(project)
    form.setFieldsValue({
      name: project.name,
      description: project.description,
      ragflow_server_id: project.ragflow_server_id,
    })
    setModalOpen(true)
  }

  /**
   * Submit create/edit form.
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      if (editingProject) {
        await updateProject(editingProject.id, values)
        message.success(t('projectManagement.updateSuccess'))
      } else {
        await createProject(values)
        message.success(t('projectManagement.createSuccess'))
      }

      setModalOpen(false)
      form.resetFields()
      fetchData()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      console.error('Failed to save project:', err)
      message.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  /**
   * Delete a project.
   *
   * @param id - Project ID
   * @param e - Mouse event (stopped to prevent card click)
   */
  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await deleteProject(id)
      message.success(t('projectManagement.deleteSuccess'))
      fetchData()
    } catch (err) {
      console.error('Failed to delete project:', err)
      message.error(String(err))
    }
  }

  /**
   * Get the server name by ID.
   *
   * @param serverId - RAGFlow server ID
   * @returns Server name or '—'
   */
  const getServerName = (serverId: string | null) => {
    if (!serverId) return '—'
    const server = servers.find((s) => s.id === serverId)
    return server?.name || '—'
  }

  /**
   * Map project status to display color.
   *
   * @param status - Project status string
   * @returns Ant Design tag color
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green'
      case 'archived': return 'default'
      default: return 'blue'
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <FolderOpen className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('projectManagement.title')}
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400 ml-10">
                {t('projectManagement.description')}
              </p>
            </div>
            <Button type="primary" icon={<Plus size={16} />} onClick={handleAdd}>
              {t('projectManagement.addProject')}
            </Button>
          </div>

          {/* Project Cards */}
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
              <Empty
                description={
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">
                      {t('projectManagement.noProjects')}
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                      {t('projectManagement.noProjectsHint')}
                    </p>
                  </div>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  hoverable
                  onClick={() => navigate(`/knowledge-base/projects/${project.id}`)}
                  className="dark:bg-slate-800 dark:border-slate-700 shadow-sm cursor-pointer"
                  title={
                    <div className="flex justify-between items-center w-full">
                      <div className="flex flex-col min-w-0">
                        <span className="text-lg font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                          {project.name}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <Tag color="blue">{getServerName(project.ragflow_server_id)}</Tag>
                          <Tag color={getStatusColor(project.status)}>
                            {project.status}
                          </Tag>
                        </div>
                      </div>
                      <Space>
                        <Tooltip title={t('projectManagement.editProject')}>
                          <Button
                            type="text"
                            icon={<Pencil size={18} className="text-slate-400" />}
                            onClick={(e: React.MouseEvent) => handleEdit(project, e)}
                          />
                        </Tooltip>
                        <Popconfirm
                          title={t('projectManagement.deleteConfirm')}
                          description={t('projectManagement.deleteWarning')}
                          onConfirm={() => handleDelete(project.id)}
                          okText={t('common.delete')}
                          cancelText={t('common.cancel')}
                        >
                          <Tooltip title={t('common.delete')}>
                            <Button
                              type="text"
                              danger
                              icon={<Trash2 size={18} />}
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    </div>
                  }
                >
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                    {project.description || t('projectManagement.noDescription', { defaultValue: '—' })}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        title={editingProject ? t('projectManagement.editProject') : t('projectManagement.addProject')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label={t('projectManagement.name')}
            rules={[{ required: true, message: `${t('projectManagement.name')} is required` }]}
          >
            <Input placeholder={t('projectManagement.namePlaceholder')} />
          </Form.Item>

          <Form.Item name="description" label={t('projectManagement.descriptionLabel')}>
            <Input.TextArea rows={2} placeholder={t('projectManagement.descriptionPlaceholder')} />
          </Form.Item>

          <Form.Item name="ragflow_server_id" label={t('projectManagement.ragflowServer')}>
            <AntSelect
              placeholder={t('projectManagement.selectServer')}
              allowClear
              options={servers
                .filter((s) => s.is_active)
                .map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ProjectListPage
