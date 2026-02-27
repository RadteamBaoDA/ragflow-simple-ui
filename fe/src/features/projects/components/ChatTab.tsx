/**
 * @fileoverview Chat tab content for the project detail page.
 *
 * Displays the chat assistant list with add/edit/delete/sync actions.
 * Resolves category selections into ragflow_dataset_ids on chat creation/update.
 *
 * @module features/projects/components/ChatTab
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Table, Popconfirm, Form, message, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Trash2, RefreshCw, Pencil, Lock } from 'lucide-react'
import {
  getProjectChats,
  createProjectChat,
  updateProjectChat,
  deleteProjectChat,
  syncProjectChat,
  type ProjectChat,
  type DocumentCategory,
  type DocumentCategoryVersion,
} from '../api/projectService'
import ChatModal from './ChatModal'
import { EntityPermissionModal } from './EntityPermissionModal'

// ============================================================================
// Types
// ============================================================================

interface ChatTabProps {
  /** Current project ID */
  projectId: string
  /** Initial chat list fetched by the parent */
  initialChats: ProjectChat[]
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
 * Chat tab — chat assistant list with CRUD.
 * Resolves selected categories → ragflow_dataset_ids on creation/update.
 *
 * @param {ChatTabProps} props - Component props
 * @returns {JSX.Element} The rendered chat tab content
 */
const ChatTab = ({
  projectId,
  initialChats,
  categories,
  categoryVersions,
  chatModels,
}: ChatTabProps) => {
  const { t } = useTranslation()

  // ── State ──────────────────────────────────────────────────────────────
  const [chats, setChats] = useState<ProjectChat[]>(initialChats)
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [editingChat, setEditingChat] = useState<ProjectChat | null>(null)
  const [chatForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [permChatId, setPermChatId] = useState<string | null>(null)
  const [permChatName, setPermChatName] = useState('')

  // Sync with parent if initialChats changes
  useEffect(() => {
    setChats(initialChats)
  }, [initialChats])

  // ── Helpers ────────────────────────────────────────────────────────────

  /**
   * Resolve selected category IDs into local version IDs and ragflow_dataset_ids.
   * Only active versions with a ragflow_dataset_id are included.
   *
   * @param categoryIds - Array of selected category IDs
   * @returns Object with dataset_ids (local) and ragflow_dataset_ids
   */
  const resolveDatasetIds = useCallback(
    (categoryIds: string[]) => {
      const datasetIds: string[] = []
      const ragflowDatasetIds: string[] = []

      for (const catId of categoryIds) {
        const versions = categoryVersions[catId] || []
        for (const version of versions) {
          if (version.ragflow_dataset_id && version.status === 'active') {
            datasetIds.push(version.id)
            ragflowDatasetIds.push(version.ragflow_dataset_id)
          }
        }
      }
      return { datasetIds, ragflowDatasetIds }
    },
    [categoryVersions],
  )

  /**
   * Build a display map: category ID → category name for table column rendering.
   */
  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  )

  /**
   * Resolve a chat's dataset_ids back to category names for display.
   *
   * @param chat - The chat record
   * @returns Array of category names that match
   */
  const getChatCategoryNames = useCallback(
    (chat: ProjectChat): string[] => {
      const names: string[] = []
      const matchedCatIds = new Set<string>()

      for (const versionId of chat.dataset_ids || []) {
        for (const [catId, versions] of Object.entries(categoryVersions)) {
          if (versions.some((v) => v.id === versionId) && !matchedCatIds.has(catId)) {
            matchedCatIds.add(catId)
            const name = categoryNameMap.get(catId)
            if (name) names.push(name)
          }
        }
      }
      return names
    },
    [categoryVersions, categoryNameMap],
  )

  // ── Handlers ───────────────────────────────────────────────────────────

  /**
   * Open modal in create mode.
   */
  const handleOpenCreate = () => {
    setEditingChat(null)
    chatForm.resetFields()
    setChatModalOpen(true)
  }

  /**
   * Open modal in edit mode with existing chat data.
   *
   * @param chat - Chat record to edit
   */
  const handleOpenEdit = (chat: ProjectChat) => {
    setEditingChat(chat)
    setChatModalOpen(true)
  }

  /**
   * Create or update a chat assistant with full config.
   * Resolves category selections to ragflow_dataset_ids before submitting.
   */
  const handleSaveChat = async () => {
    try {
      const values = await chatForm.validateFields()
      setSaving(true)

      // Resolve selected categories → dataset IDs
      const { datasetIds, ragflowDatasetIds } = resolveDatasetIds(
        values.category_ids || [],
      )

      // Build the payload
      const payload = {
        name: values.name,
        dataset_ids: datasetIds,
        ragflow_dataset_ids: ragflowDatasetIds,
        llm_config: values.llm_config || {},
        prompt_config: values.prompt_config || {},
      }

      if (editingChat) {
        // Update existing chat
        await updateProjectChat(projectId, editingChat.id, payload)
        message.success(t('projectManagement.chats.updateSuccess'))
      } else {
        // Create new chat
        await createProjectChat(projectId, payload)
        message.success(t('projectManagement.chats.createSuccess'))
      }

      setChatModalOpen(false)
      setEditingChat(null)
      chatForm.resetFields()
      const chatData = await getProjectChats(projectId)
      setChats(chatData)
    } catch (err) {
      // Skip validation errors (antd form)
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  /**
   * Delete a chat assistant.
   *
   * @param chatId - Chat UUID to delete
   */
  const handleDeleteChat = async (chatId: string) => {
    try {
      await deleteProjectChat(projectId, chatId)
      const chatData = await getProjectChats(projectId)
      setChats(chatData)
    } catch (err) {
      message.error(String(err))
    }
  }

  /**
   * Sync a chat assistant from RAGFlow.
   *
   * @param chatId - Chat UUID to sync
   */
  const handleSyncChat = async (chatId: string) => {
    try {
      setSyncingId(chatId)
      await syncProjectChat(projectId, chatId)
      const chatData = await getProjectChats(projectId)
      setChats(chatData)
      message.success(t('projectManagement.chats.syncSuccess'))
    } catch (err) {
      message.error(String(err))
    } finally {
      setSyncingId(null)
    }
  }

  // ── Table columns ──────────────────────────────────────────────────────

  /** Chat assistant table columns */
  const chatColumns: ColumnsType<ProjectChat> = [
    {
      title: t('projectManagement.chats.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('projectManagement.chats.datasets'),
      key: 'categories',
      render: (_: unknown, record: ProjectChat) => {
        const names = getChatCategoryNames(record)
        if (names.length === 0) return <span className="text-gray-400">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {names.map((name) => (
              <Tag key={name} color="blue">{name}</Tag>
            ))}
          </div>
        )
      },
    },
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
      width: 150,
      render: (_: unknown, record: ProjectChat) => (
        <div className="flex items-center gap-1">
          <Button
            type="text"
            size="small"
            icon={<Lock size={14} />}
            onClick={() => { setPermChatId(record.id); setPermChatName(record.name) }}
            title={t('projectManagement.entityPermissions.title', 'Permissions')}
          />
          <Button
            type="text"
            size="small"
            icon={<Pencil size={14} />}
            onClick={() => handleOpenEdit(record)}
            title={t('projectManagement.chats.edit')}
          />
          <Button
            type="text"
            size="small"
            icon={<RefreshCw size={14} />}
            loading={syncingId === record.id}
            onClick={() => handleSyncChat(record.id)}
            title={t('projectManagement.chats.sync')}
          />
          <Popconfirm
            title={t('projectManagement.chats.deleteConfirm')}
            onConfirm={() => handleDeleteChat(record.id)}
          >
            <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
          </Popconfirm>
        </div>
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
          <Button icon={<Plus size={14} />} onClick={handleOpenCreate}>
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

      {/* Chat create/edit modal */}
      <ChatModal
        open={chatModalOpen}
        form={chatForm}
        saving={saving}
        onOk={handleSaveChat}
        onCancel={() => {
          setChatModalOpen(false)
          setEditingChat(null)
          chatForm.resetFields()
        }}
        categories={categories}
        categoryVersions={categoryVersions}
        chatModels={chatModels}
        editingChat={editingChat}
      />
      {permChatId && (
        <EntityPermissionModal
          open={!!permChatId}
          onClose={() => setPermChatId(null)}
          projectId={projectId}
          entityType="chat"
          entityId={permChatId}
          entityName={permChatName}
        />
      )}
    </>
  )
}

export default ChatTab
