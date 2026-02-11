
/**
 * ProjectChatService: Business logic for project chat assistant management.
 * Handles CRUD with RAGFlow chat assistant sync.
 * Implements Singleton pattern.
 */
import { ModelFactory } from '@/shared/models/factory.js'
import { ProjectChat } from '@/shared/models/types.js'
import { ragflowProxyService } from '@/shared/services/ragflow-proxy.service.js'

/**
 * Service managing project chat assistants.
 */
export class ProjectChatService {
  private static instance: ProjectChatService

  /**
   * Get the shared singleton instance.
   * @returns ProjectChatService singleton
   */
  static getSharedInstance(): ProjectChatService {
    if (!this.instance) {
      this.instance = new ProjectChatService()
    }
    return this.instance
  }

  /**
   * List chat assistants for a project.
   * @param projectId - Project UUID
   * @returns Array of project chats
   */
  async listByProject(projectId: string): Promise<ProjectChat[]> {
    return ModelFactory.projectChat.findByProject(projectId)
  }

  /**
   * Get a single chat assistant by ID.
   * @param id - Chat UUID
   * @returns Chat record or undefined
   */
  async getById(id: string): Promise<ProjectChat | undefined> {
    return ModelFactory.projectChat.findById(id)
  }

  /**
   * Create a new chat assistant.
   * Creates both locally and in RAGFlow.
   * @param data - Chat creation data
   * @param serverId - RAGFlow server ID
   * @param userId - User performing the action
   * @returns Created chat record
   */
  async create(data: {
    project_id: string
    name: string
    dataset_ids?: string[]
    ragflow_dataset_ids?: string[]
    llm_config?: Record<string, any>
    prompt_config?: Record<string, any>
  }, serverId: string, userId?: string): Promise<ProjectChat> {
    // Create in RAGFlow first
    let ragflowChat: any = null
    try {
      ragflowChat = await ragflowProxyService.createChatAssistant(serverId, {
        name: data.name,
        dataset_ids: data.ragflow_dataset_ids || [],
        ...(data.llm_config ? { llm: data.llm_config } : {}),
        ...(data.prompt_config ? { prompt: data.prompt_config } : {})
      })
    } catch (err) {
      console.error('Failed to create RAGFlow chat assistant:', err)
      throw new Error('Failed to create RAGFlow chat assistant. Please verify server connection.')
    }

    // Create local record
    return ModelFactory.projectChat.create({
      project_id: data.project_id,
      name: data.name,
      ragflow_chat_id: ragflowChat?.id,
      dataset_ids: data.dataset_ids || [],
      ragflow_dataset_ids: data.ragflow_dataset_ids || [],
      llm_config: data.llm_config || {},
      prompt_config: data.prompt_config || {},
      status: 'active',
      last_synced_at: new Date(),
      created_by: userId,
      updated_by: userId
    } as Partial<ProjectChat>)
  }

  /**
   * Update a chat assistant.
   * Updates both locally and in RAGFlow.
   * @param id - Chat UUID
   * @param data - Fields to update
   * @param serverId - RAGFlow server ID
   * @param userId - User performing the action
   * @returns Updated chat record
   */
  async update(id: string, data: Partial<ProjectChat>, serverId: string, userId?: string): Promise<ProjectChat> {
    const existing = await ModelFactory.projectChat.findById(id)
    if (!existing) throw new Error('Chat assistant not found')

    // Update in RAGFlow if it has a ragflow_chat_id
    if (existing.ragflow_chat_id) {
      try {
        const ragflowUpdate: Record<string, any> = {}
        if (data.name) ragflowUpdate.name = data.name
        if (data.ragflow_dataset_ids) ragflowUpdate.dataset_ids = data.ragflow_dataset_ids
        if (data.llm_config) ragflowUpdate.llm = data.llm_config
        if (data.prompt_config) ragflowUpdate.prompt = data.prompt_config

        if (Object.keys(ragflowUpdate).length > 0) {
          await ragflowProxyService.updateChatAssistant(serverId, existing.ragflow_chat_id, ragflowUpdate)
        }
      } catch (err) {
        console.error('Failed to update RAGFlow chat assistant:', err)
      }
    }

    // Update local record
    return ModelFactory.projectChat.update(id, {
      ...data,
      last_synced_at: new Date(),
      updated_by: userId
    } as Partial<ProjectChat>) as Promise<ProjectChat>
  }

  /**
   * Delete a chat assistant.
   * Deletes from both local DB and RAGFlow.
   * @param id - Chat UUID
   * @param serverId - RAGFlow server ID
   */
  async remove(id: string, serverId?: string): Promise<void> {
    const existing = await ModelFactory.projectChat.findById(id)
    if (!existing) throw new Error('Chat assistant not found')

    // Delete from RAGFlow
    if (serverId && existing.ragflow_chat_id) {
      try {
        await ragflowProxyService.deleteChatAssistants(serverId, [existing.ragflow_chat_id])
      } catch (err) {
        console.error('Failed to delete RAGFlow chat assistant:', err)
      }
    }

    await ModelFactory.projectChat.delete(id)
  }

  /**
   * Sync a chat assistant's data from RAGFlow.
   * @param id - Chat UUID
   * @param serverId - RAGFlow server ID
   * @returns Updated chat record
   */
  async sync(id: string, serverId: string): Promise<ProjectChat> {
    const existing = await ModelFactory.projectChat.findById(id)
    if (!existing) throw new Error('Chat assistant not found')
    if (!existing.ragflow_chat_id) throw new Error('Chat has no RAGFlow assistant linked')

    const assistants = await ragflowProxyService.listChatAssistants(serverId, {
      id: existing.ragflow_chat_id
    })
    const assistant = assistants?.[0]

    if (!assistant) throw new Error('RAGFlow chat assistant not found on server')

    return ModelFactory.projectChat.update(id, {
      name: assistant.name || existing.name,
      ragflow_dataset_ids: assistant.dataset_ids || existing.ragflow_dataset_ids,
      llm_config: assistant.llm || existing.llm_config,
      prompt_config: assistant.prompt || existing.prompt_config,
      last_synced_at: new Date()
    }) as Promise<ProjectChat>
  }
}

export const projectChatService = ProjectChatService.getSharedInstance()
