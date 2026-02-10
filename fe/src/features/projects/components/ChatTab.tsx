/**
 * @fileoverview Chat tab content for the project detail page.
 *
 * Displays the chat assistant list with add/delete actions.
 * Owns all chat state and CRUD handlers.
 *
 * @module features/projects/components/ChatTab
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Table, Popconfirm, Form, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Trash2 } from 'lucide-react'
import {
  getProjectChats,
  createProjectChat,
  deleteProjectChat,
  type ProjectChat,
} from '../api/projectService'
import ChatModal from './ChatModal'

// ============================================================================
// Types
// ============================================================================

interface ChatTabProps {
  /** Current project ID */
  projectId: string
  /** Initial chat list fetched by the parent */
  initialChats: ProjectChat[]
}

// ============================================================================
// Component
// ============================================================================

/**
 * Chat tab — chat assistant list with CRUD.
 *
 * @param {ChatTabProps} props - Component props
 * @returns {JSX.Element} The rendered chat tab content
 */
const ChatTab = ({ projectId, initialChats }: ChatTabProps) => {
  const { t } = useTranslation()

  // ── State ──────────────────────────────────────────────────────────────
  const [chats, setChats] = useState<ProjectChat[]>(initialChats)
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [chatForm] = Form.useForm()
  const [saving, setSaving] = useState(false)

  // Sync with parent if initialChats changes
  useEffect(() => {
    setChats(initialChats)
  }, [initialChats])

  // ── Handlers ───────────────────────────────────────────────────────────

  /** Create a new chat assistant */
  const handleCreateChat = async () => {
    try {
      const values = await chatForm.validateFields()
      setSaving(true)
      await createProjectChat(projectId, values)
      setChatModalOpen(false)
      chatForm.resetFields()
      const chatData = await getProjectChats(projectId)
      setChats(chatData)
      message.success(t('projectManagement.chats.syncSuccess'))
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  /** Delete a chat assistant */
  const handleDeleteChat = async (chatId: string) => {
    try {
      await deleteProjectChat(projectId, chatId)
      const chatData = await getProjectChats(projectId)
      setChats(chatData)
    } catch (err) {
      message.error(String(err))
    }
  }

  // ── Table columns ──────────────────────────────────────────────────────

  /** Chat assistant table columns */
  const chatColumns: ColumnsType<ProjectChat> = [
    { title: t('projectManagement.chats.name'), dataIndex: 'name', key: 'name' },
    {
      title: 'RAGFlow ID',
      dataIndex: 'ragflow_chat_id',
      key: 'ragflow_chat_id',
      ellipsis: true,
      render: (text: string) => text || '—',
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: ProjectChat) => (
        <Popconfirm title={t('projectManagement.chats.deleteConfirm')} onConfirm={() => handleDeleteChat(record.id)}>
          <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
        </Popconfirm>
      ),
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('projectManagement.chats.title')}
          </h3>
          <Button icon={<Plus size={14} />} onClick={() => setChatModalOpen(true)}>
            {t('projectManagement.chats.add')}
          </Button>
        </div>
        <Table
          rowKey="id"
          columns={chatColumns}
          dataSource={chats}
          pagination={false}
          locale={{ emptyText: t('projectManagement.chats.noChatsHint') }}
        />
      </div>

      {/* Modal */}
      <ChatModal
        open={chatModalOpen}
        form={chatForm}
        saving={saving}
        onOk={handleCreateChat}
        onCancel={() => setChatModalOpen(false)}
      />
    </>
  )
}

export default ChatTab
