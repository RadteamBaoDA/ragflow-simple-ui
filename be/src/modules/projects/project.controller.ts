
/**
 * ProjectController: Handles HTTP requests for project management.
 */
import { Request, Response } from 'express'
import { projectService } from '@/modules/projects/project.service.js'
import { ModelFactory } from '@/shared/models/factory.js'

/**
 * Controller class for project API endpoints.
 */
export class ProjectController {
  /**
   * List projects accessible by the current user.
   * GET /api/projects
   */
  static async list(req: Request, res: Response) {
    try {
      const user = req.user
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      // Get user's team IDs using the model's dedicated method
      const teamIds = await ModelFactory.userTeam.findTeamsByUserId(user.id)

      const projects = await projectService.listForUser(user.id, user.role, teamIds)
      res.json(projects)
    } catch (error) {
      console.error('Error listing projects:', error)
      res.status(500).json({ error: 'Failed to list projects' })
    }
  }

  /**
   * Get a project by ID.
   * GET /api/projects/:id
   */
  static async getById(req: Request, res: Response) {
    try {
      if (!req.params.id) {
        res.status(400).json({ error: 'Project ID is required' })
        return
      }
      const project = await projectService.getById(req.params.id)
      if (!project) {
        res.status(404).json({ error: 'Project not found' })
        return
      }
      res.json(project)
    } catch (error) {
      console.error('Error getting project:', error)
      res.status(500).json({ error: 'Failed to get project' })
    }
  }

  /**
   * Create a new project. Admin only.
   * POST /api/projects
   */
  static async create(req: Request, res: Response) {
    try {
      const { name, description, avatar, ragflow_server_id, default_embedding_model, default_chunk_method, default_parser_config } = req.body
      if (!name) {
        res.status(400).json({ error: 'Project name is required' })
        return
      }
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      const userId = req.user.id
      const project = await projectService.create({
        name, description, avatar, ragflow_server_id,
        default_embedding_model, default_chunk_method, default_parser_config
      }, userId)
      res.status(201).json(project)
    } catch (error: any) {
      console.error('Error creating project:', error)
      if (error.message === 'RAGFlow server not found') {
        res.status(400).json({ error: error.message })
        return
      }
      res.status(500).json({ error: 'Failed to create project' })
    }
  }

  /**
   * Update an existing project.
   * PUT /api/projects/:id
   */
  static async update(req: Request, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      if (!req.params.id) {
        res.status(400).json({ error: 'Project ID is required' })
        return
      }
      const userId = req.user.id
      const project = await projectService.update(req.params.id, req.body, userId)
      res.json(project)
    } catch (error: any) {
      console.error('Error updating project:', error)
      if (error.message === 'Project not found') {
        res.status(404).json({ error: 'Project not found' })
        return
      }
      res.status(500).json({ error: 'Failed to update project' })
    }
  }

  /**
   * Delete a project.
   * DELETE /api/projects/:id
   */
  static async remove(req: Request, res: Response) {
    try {
      if (!req.params.id) {
        res.status(400).json({ error: 'Project ID is required' })
        return
      }
      await projectService.remove(req.params.id)
      res.status(204).send()
    } catch (error: any) {
      console.error('Error deleting project:', error)
      if (error.message === 'Project not found') {
        res.status(404).json({ error: 'Project not found' })
        return
      }
      res.status(500).json({ error: 'Failed to delete project' })
    }
  }

  // =========================================================================
  // Permissions
  // =========================================================================

  /**
   * Get permissions for a project.
   * GET /api/projects/:id/permissions
   */
  static async getPermissions(req: Request, res: Response) {
    try {
      if (!req.params.id) {
        res.status(400).json({ error: 'Project ID is required' })
        return
      }
      const permissions = await projectService.getPermissions(req.params.id)
      res.json(permissions)
    } catch (error) {
      console.error('Error getting permissions:', error)
      res.status(500).json({ error: 'Failed to get permissions' })
    }
  }

  /**
   * Set permission for a grantee on a project.
   * POST /api/projects/:id/permissions
   */
  static async setPermission(req: Request, res: Response) {
    try {
      const { grantee_type, grantee_id, tab_documents, tab_chat, tab_settings } = req.body
      if (!grantee_type || !grantee_id) {
        res.status(400).json({ error: 'grantee_type and grantee_id are required' })
        return
      }
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      if (!req.params.id) {
        res.status(400).json({ error: 'Project ID is required' })
        return
      }
      const userId = req.user.id
      const permission = await projectService.setPermission({
        project_id: req.params.id,
        grantee_type,
        grantee_id,
        tab_documents: tab_documents || 'none',
        tab_chat: tab_chat || 'none',
        tab_settings: tab_settings || 'none'
      }, userId)
      res.json(permission)
    } catch (error) {
      console.error('Error setting permission:', error)
      res.status(500).json({ error: 'Failed to set permission' })
    }
  }

  /**
   * Remove a permission.
   * DELETE /api/projects/:id/permissions/:permissionId
   */
  static async removePermission(req: Request, res: Response) {
    try {
      if (!req.params.id) {
        res.status(400).json({ error: 'Project ID is required' })
        return
      }
      if (!req.params.permissionId) {
        res.status(400).json({ error: 'Permission ID is required' })
        return
      }
      await projectService.removePermission(req.params.permissionId)
      res.status(204).send()
    } catch (error) {
      console.error('Error removing permission:', error)
      res.status(500).json({ error: 'Failed to remove permission' })
    }
  }
}
