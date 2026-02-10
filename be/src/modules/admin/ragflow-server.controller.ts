
/**
 * RagflowServerController: Handles HTTP requests for RAGFlow server management.
 * Admin-only endpoints.
 */
import { Request, Response } from 'express'
import { ragflowServerService } from '@/shared/services/ragflow-server.service.js'

/**
 * Controller class for RAGFlow server API endpoints.
 */
export class RagflowServerController {
  /**
   * List all RAGFlow servers.
   * GET /api/ragflow-servers
   */
  static async list(req: Request, res: Response) {
    try {
      const servers = await ragflowServerService.list()
      // Mask API keys in response
      const masked = servers.map(s => ({
        ...s,
        api_key: s.api_key ? '****' + s.api_key.slice(-4) : ''
      }))
      res.json(masked)
    } catch (error) {
      console.error('Error listing RAGFlow servers:', error)
      res.status(500).json({ error: 'Failed to list servers' })
    }
  }

  /**
   * Get a single RAGFlow server by ID.
   * GET /api/ragflow-servers/:id
   */
  static async getById(req: Request, res: Response) {
    try {
      const server = await ragflowServerService.getById(req.params.id)
      if (!server) {
        res.status(404).json({ error: 'Server not found' })
        return
      }
      // Mask API key
      res.json({ ...server, api_key: '****' + server.api_key.slice(-4) })
    } catch (error) {
      console.error('Error getting RAGFlow server:', error)
      res.status(500).json({ error: 'Failed to get server' })
    }
  }

  /**
   * Create a new RAGFlow server.
   * POST /api/ragflow-servers
   * Body: { name, endpoint_url, api_key, description? }
   */
  static async create(req: Request, res: Response) {
    try {
      const { name, endpoint_url, api_key, description } = req.body
      if (!name || !endpoint_url || !api_key) {
        res.status(400).json({ error: 'name, endpoint_url, and api_key are required' })
        return
      }
      // @ts-ignore - userId from auth middleware
      const userId = req.user?.id
      const server = await ragflowServerService.create(
        { name, endpoint_url, api_key, description },
        userId
      )
      res.status(201).json({ ...server, api_key: '****' + server.api_key.slice(-4) })
    } catch (error: any) {
      console.error('Error creating RAGFlow server:', error)
      if (error.message?.includes('unique')) {
        res.status(409).json({ error: 'Server name already exists' })
        return
      }
      res.status(500).json({ error: 'Failed to create server' })
    }
  }

  /**
   * Update an existing RAGFlow server.
   * PUT /api/ragflow-servers/:id
   */
  static async update(req: Request, res: Response) {
    try {
      const { name, endpoint_url, api_key, description, is_active } = req.body
      // @ts-ignore
      const userId = req.user?.id
      const server = await ragflowServerService.update(
        req.params.id,
        { name, endpoint_url, api_key, description, is_active },
        userId
      )
      res.json({ ...server, api_key: '****' + server.api_key.slice(-4) })
    } catch (error: any) {
      console.error('Error updating RAGFlow server:', error)
      if (error.message === 'Server not found') {
        res.status(404).json({ error: 'Server not found' })
        return
      }
      res.status(500).json({ error: 'Failed to update server' })
    }
  }

  /**
   * Delete a RAGFlow server.
   * DELETE /api/ragflow-servers/:id
   */
  static async remove(req: Request, res: Response) {
    try {
      await ragflowServerService.remove(req.params.id)
      res.status(204).send()
    } catch (error: any) {
      console.error('Error deleting RAGFlow server:', error)
      if (error.message === 'Server not found') {
        res.status(404).json({ error: 'Server not found' })
        return
      }
      if (error.message?.startsWith('Cannot delete')) {
        res.status(409).json({ error: error.message })
        return
      }
      res.status(500).json({ error: 'Failed to delete server' })
    }
  }

  /**
   * Test connectivity to a RAGFlow server.
   * POST /api/ragflow-servers/test-connection
   * Body: { id? } or { endpoint_url, api_key }
   */
  static async testConnection(req: Request, res: Response) {
    try {
      const { id, endpoint_url, api_key } = req.body
      const connected = await ragflowServerService.testConnection(id, endpoint_url, api_key)
      res.json({ connected })
    } catch (error: any) {
      console.error('Error testing RAGFlow connection:', error)
      res.json({ connected: false, error: error.message })
    }
  }
}
