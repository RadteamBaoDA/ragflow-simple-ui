/**
 * @fileoverview Admin page for managing RAGFlow server connections.
 *
 * Features:
 * - Table listing all RAGFlow servers with status
 * - Add/edit server modal with form validation
 * - Test connection button per server
 * - Delete server with confirmation
 * - Dark/light theme support
 * - Full i18n support
 *
 * @module features/ragflow-servers/pages/RagflowServersPage
 */

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  Space,
  Tag,
  Popconfirm,
  message,
  Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  Plus,
  Pencil,
  Trash2,
  PlugZap,
  Server,
  Loader2,
} from 'lucide-react'
import {
  getRagflowServers,
  createRagflowServer,
  updateRagflowServer,
  deleteRagflowServer,
  testRagflowConnection,
  type RagflowServer,
} from '../api/ragflowServerService'

// ============================================================================
// Component
// ============================================================================

/**
 * RAGFlow Servers management page.
 *
 * Provides a data table with CRUD operations and connection testing
 * for RAGFlow server configurations. Admin-only access.
 */
const RagflowServersPage = () => {
  const { t } = useTranslation()
  const [form] = Form.useForm()

  // Data state
  const [servers, setServers] = useState<RagflowServer[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<RagflowServer | null>(null)
  const [saving, setSaving] = useState(false)

  // Connection test state (keyed by server ID)
  const [testingMap, setTestingMap] = useState<Record<string, boolean>>({})

  /**
   * Fetch all RAGFlow servers from the API.
   * Updates loading state during the request.
   */
  const fetchServers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getRagflowServers()
      setServers(data)
    } catch (err) {
      console.error('Failed to fetch RAGFlow servers:', err)
      message.error(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  /** Effect: Load servers on mount */
  useEffect(() => {
    fetchServers()
  }, [fetchServers])

  /**
   * Open modal for creating a new server.
   * Resets form fields to defaults.
   */
  const handleAdd = () => {
    setEditingServer(null)
    form.resetFields()
    form.setFieldsValue({ is_active: true })
    setModalOpen(true)
  }

  /**
   * Open modal for editing an existing server.
   * Pre-fills form with server data.
   *
   * @param server - The server record to edit
   */
  const handleEdit = (server: RagflowServer) => {
    setEditingServer(server)
    form.setFieldsValue({
      name: server.name,
      endpoint_url: server.endpoint_url,
      api_key: server.api_key,
      description: server.description,
      is_active: server.is_active,
    })
    setModalOpen(true)
  }

  /**
   * Submit the create/edit form.
   * Validates fields, sends API request, then refreshes the table.
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      if (editingServer) {
        // Update existing server
        await updateRagflowServer(editingServer.id, values)
        message.success(t('ragflowServers.updateSuccess'))
      } else {
        // Create new server
        await createRagflowServer(values)
        message.success(t('ragflowServers.createSuccess'))
      }

      setModalOpen(false)
      form.resetFields()
      fetchServers()
    } catch (err) {
      // Ant Design form validation errors are handled internally
      if (err && typeof err === 'object' && 'errorFields' in err) return
      console.error('Failed to save server:', err)
      message.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  /**
   * Delete a server after confirmation.
   *
   * @param id - Server ID to delete
   */
  const handleDelete = async (id: string) => {
    try {
      await deleteRagflowServer(id)
      message.success(t('ragflowServers.deleteSuccess'))
      fetchServers()
    } catch (err) {
      console.error('Failed to delete server:', err)
      message.error(String(err))
    }
  }

  /**
   * Test the connection to a specific RAGFlow server.
   * Shows a loading spinner on the button while testing.
   *
   * @param id - Server ID to test
   */
  const handleTestConnection = async (id: string) => {
    try {
      setTestingMap((prev) => ({ ...prev, [id]: true }))
      const result = await testRagflowConnection({ id })
      if (result.connected) {
        message.success(t('ragflowServers.connectionSuccess'))
      } else {
        message.error(`${t('ragflowServers.connectionFailed')}: ${result.error || ''}`)
      }
    } catch (err) {
      console.error('Connection test failed:', err)
      message.error(t('ragflowServers.connectionFailed'))
    } finally {
      setTestingMap((prev) => ({ ...prev, [id]: false }))
    }
  }

  // Table column definitions
  const columns: ColumnsType<RagflowServer> = [
    {
      title: t('ragflowServers.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: t('ragflowServers.endpointUrl'),
      dataIndex: 'endpoint_url',
      key: 'endpoint_url',
      ellipsis: true,
    },
    {
      title: t('ragflowServers.descriptionLabel'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || '—',
    },
    {
      title: t('projectManagement.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>
          {active ? t('ragflowServers.active') : t('ragflowServers.inactive')}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: RagflowServer) => (
        <Space size="small">
          <Tooltip title={t('ragflowServers.testConnection')}>
            <Button
              type="text"
              size="small"
              icon={testingMap[record.id] ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
              onClick={() => handleTestConnection(record.id)}
              disabled={testingMap[record.id]}
            />
          </Tooltip>
          <Tooltip title={t('ragflowServers.editServer')}>
            <Button
              type="text"
              size="small"
              icon={<Pencil size={16} />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title={t('ragflowServers.deleteConfirm')}
            description={t('ragflowServers.deleteWarning')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.delete')}
            cancelText={t('common.cancel')}
          >
            <Button type="text" size="small" danger icon={<Trash2 size={16} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Server className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('ragflowServers.title')}
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400 ml-10">
                {t('ragflowServers.description')}
              </p>
            </div>
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={handleAdd}
            >
              {t('ragflowServers.addServer')}
            </Button>
          </div>

          {/* Table */}
          <Table
            rowKey="id"
            columns={columns}
            dataSource={servers}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            locale={{
              emptyText: (
                <div className="py-12 text-center">
                  <Server className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">
                    {t('ragflowServers.noServers')}
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm">
                    {t('ragflowServers.noServersHint')}
                  </p>
                </div>
              ),
            }}
          />
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        title={editingServer ? t('ragflowServers.editServer') : t('ragflowServers.addServer')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        destroyOnHidden
        width={520}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label={t('ragflowServers.name')}
            rules={[{ required: true, message: t('ragflowServers.nameRequired') }]}
          >
            <Input placeholder={t('ragflowServers.namePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="endpoint_url"
            label={t('ragflowServers.endpointUrl')}
            rules={[{ required: true, message: t('ragflowServers.endpointRequired') }]}
          >
            <Input placeholder={t('ragflowServers.endpointUrlPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="api_key"
            label={t('ragflowServers.apiKey')}
            rules={[{ required: true, message: t('ragflowServers.apiKeyRequired') }]}
          >
            <Input.Password placeholder={t('ragflowServers.apiKeyPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('ragflowServers.descriptionLabel')}
          >
            <Input.TextArea
              rows={2}
              placeholder={t('ragflowServers.descriptionPlaceholder')}
            />
          </Form.Item>

          <Form.Item
            name="is_active"
            label={t('projectManagement.status')}
            valuePropName="checked"
          >
            <Switch
              checkedChildren={t('ragflowServers.active')}
              unCheckedChildren={t('ragflowServers.inactive')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default RagflowServersPage
