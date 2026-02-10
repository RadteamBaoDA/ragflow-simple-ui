
/**
 * ProjectChatController: Handles HTTP requests for project chat assistants.
 */
import { Request, Response } from 'express'
import { projectChatService } from '@/shared/services/project-chat.service.js'
import { ModelFactory } from '@/shared/models/factory.js'

/**
 * Controller for project chat assistant API endpoints.
 */
export class ProjectChatController {
  /**
   * List chat assistants for a project.
   * GET /api/projects/:projectId/chats
   */
  static async list(req: Request, res: Response) {
    try {
      const chats = await projectChatService.listByProject(req.params.projectId)
      res.json(chats)
    } catch (error) {
      console.error('Error listing project chats:', error)
      res.status(500).json({ error: 'Failed to list chat assistants' })
    }
  }

  /**
   * Get a single chat assistant.
   * GET /api/projects/:projectId/chats/:chatId
   */
  static async getById(req: Request, res: Response) {
    try {
      const chat = await projectChatService.getById(req.params.chatId)
      if (!chat) {
        res.status(404).json({ error: 'Chat assistant not found' })
        return
      }
      res.json(chat)
    } catch (error) {
      console.error('Error getting project chat:', error)
      res.status(500).json({ error: 'Failed to get chat assistant' })
    }
  }

  /**
   * Create a new chat assistant.
   * POST /api/projects/:projectId/chats
   */
  static async create(req: Request, res: Response) {
    try {
      const { name, dataset_ids, ragflow_dataset_ids, llm_config, prompt_config } = req.body
      if (!name) {
        res.status(400).json({ error: 'Chat assistant name is required' })
        return
      }

      // Resolve project's RAGFlow server
      const project = await ModelFactory.project.findById(req.params.projectId)
      if (!project?.ragflow_server_id) {
        res.status(400).json({ error: 'Project must have a RAGFlow server assigned' })
        return
      }

      // @ts-ignore
      const userId = req.user?.id
      const chat = await projectChatService.create({
        project_id: req.params.projectId,
        name,
        dataset_ids,
        ragflow_dataset_ids,
        llm_config,
        prompt_config
      }, project.ragflow_server_id, userId)
      res.status(201).json(chat)
    } catch (error: any) {
      console.error('Error creating project chat:', error)
      res.status(500).json({ error: error.message || 'Failed to create chat assistant' })
    }
  }

  /**
   * Update a chat assistant.
   * PUT /api/projects/:projectId/chats/:chatId
   */
  static async update(req: Request, res: Response) {
    try {
      const project = await ModelFactory.project.findById(req.params.projectId)
      if (!project?.ragflow_server_id) {
        res.status(400).json({ error: 'Project must have a RAGFlow server assigned' })
        return
      }

      // @ts-ignore
      const userId = req.user?.id
      const chat = await projectChatService.update(
        req.params.chatId, req.body, project.ragflow_server_id, userId
      )
      res.json(chat)
    } catch (error: any) {
      console.error('Error updating project chat:', error)
      if (error.message === 'Chat assistant not found') {
        res.status(404).json({ error: 'Chat assistant not found' })
        return
      }
      res.status(500).json({ error: error.message || 'Failed to update chat assistant' })
    }
  }

  /**
   * Delete a chat assistant.
   * DELETE /api/projects/:projectId/chats/:chatId
   */
  static async remove(req: Request, res: Response) {
    try {
      const project = await ModelFactory.project.findById(req.params.projectId)
      await projectChatService.remove(
        req.params.chatId,
        project?.ragflow_server_id || undefined
      )
      res.status(204).send()
    } catch (error: any) {
      console.error('Error deleting project chat:', error)
      if (error.message === 'Chat assistant not found') {
        res.status(404).json({ error: 'Chat assistant not found' })
        return
      }
      res.status(500).json({ error: 'Failed to delete chat assistant' })
    }
  }

  /**
   * Sync a chat assistant from RAGFlow.
   * POST /api/projects/:projectId/chats/:chatId/sync
   */
  static async sync(req: Request, res: Response) {
    try {
      const project = await ModelFactory.project.findById(req.params.projectId)
      if (!project?.ragflow_server_id) {
        res.status(400).json({ error: 'Project must have a RAGFlow server assigned' })
        return
      }
      const chat = await projectChatService.sync(req.params.chatId, project.ragflow_server_id)
      res.json(chat)
    } catch (error: any) {
      console.error('Error syncing project chat:', error)
      res.status(500).json({ error: error.message || 'Failed to sync chat assistant' })
    }
  }
}
