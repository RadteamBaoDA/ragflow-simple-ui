/**
 * User controller: manages user CRUD, role/permission changes, and IP history access.
 * Emphasizes IDOR prevention (ownership/role checks occur in middleware) and audit logging for sensitive updates.
 */
import { Request, Response } from 'express'
import { userService } from '@/modules/users/user.service.js'
import { log } from '@/shared/services/logger.service.js'
import { getClientIp } from '@/shared/utils/ip.js'
import { auditService, AuditAction, AuditResourceType } from '@/modules/audit/audit.service.js'

export class UserController {
  /**
   * Get list of users, optionally filtered by role.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      // Optional roles filter lets UI fetch scoped lists without extra endpoints
      const roles = req.query.roles ? (req.query.roles as string).split(',') : undefined
      // Fetch users via service
      const users = await userService.getAllUsers(roles as any)
      // Map snake_case to camelCase for frontend compatibility
      const mappedUsers = users.map(u => ({
        ...u,
        displayName: u.display_name,
      }))
      res.json(mappedUsers)
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to fetch users', { error: String(error) })
      res.status(500).json({ error: 'Failed to fetch users' })
    }
  }

  /**
   * Get IP history for all users.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getAllIpHistory(req: Request, res: Response): Promise<void> {
    try {
      // Fetch IP history map from service
      const historyMap = await userService.getAllUsersIpHistory()
      // Convert Map to plain object for JSON serialization
      const historyObject: Record<string, any[]> = {}
      for (const [userId, history] of historyMap.entries()) {
        historyObject[userId] = history
      }
      res.json(historyObject)
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to fetch IP history', { error: error instanceof Error ? error.message : String(error) })
      res.status(500).json({ error: 'Failed to fetch IP history' })
    }
  }

  /**
   * Get IP history for a specific user.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getUserIpHistory(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    // Validate user ID
    if (!id) {
      res.status(400).json({ error: 'User ID is required' })
      return
    }

    try {
      // Fetch user specific history
      const history = await userService.getUserIpHistory(id)
      res.json(history)
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to fetch user IP history', { error: error instanceof Error ? error.message : String(error), userId: id })
      res.status(500).json({ error: 'Failed to fetch IP history' })
    }
  }

  /**
   * Update a user's role.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async updateUserRole(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { role } = req.body

    // Ensure input is string
    if (typeof id !== 'string' || typeof role !== 'string') {
      res.status(400).json({ error: 'Invalid input' })
      return
    }

    try {
      // Validate actor (must be authenticated)
      const actor = req.session.user ? {
        id: req.session.user.id,
        role: req.session.user.role,
        email: req.session.user.email,
        ip: getClientIp(req)
      } : undefined;

      if (!actor) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Update role via service
      const updatedUser = await userService.updateUserRole(id, role, actor)

      if (!updatedUser) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      res.json(updatedUser)
    } catch (error: any) {
      const message = error.message || String(error);
      // Handle business logic errors
      if (message === 'Invalid user ID format' || message === 'Invalid role' || message === 'Cannot modify your own role') {
        res.status(400).json({ error: message });
        return;
      }
      if (message === 'Only administrators can grant admin role') {
        res.status(403).json({ error: message });
        return;
      }

      log.error('Failed to update user role', { error: message })
      res.status(500).json({ error: 'Failed to update user role' })
    }
  }

  /**
   * Update a user's permissions.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async updateUserPermissions(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { permissions } = req.body

    // Validate inputs
    if (!id) {
      res.status(400).json({ error: 'User ID is required' })
      return
    }

    if (!Array.isArray(permissions)) {
      res.status(400).json({ error: 'Permissions must be an array of strings' })
      return
    }

    try {
      // Capture user context for audit
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      // Update permissions via service
      await userService.updateUserPermissions(id, permissions, user)
      res.json({ success: true })
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to update user permissions', { userId: id, error: String(error) })
      res.status(500).json({ error: 'Failed to update user permissions' })
    }
  }

  /**
   * Create a new user (admin only).
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async createUser(req: Request, res: Response): Promise<void> {
    try {
      // Capture user context for audit
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      // Create user via service
      const newUser = await userService.createUser(req.body, user)
      res.status(201).json(newUser)
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to create user', { error: String(error) })
      res.status(500).json({ error: 'Failed to create user' })
    }
  }

  /**
   * Update user details.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    // Validate ID
    if (!id) {
      res.status(400).json({ error: 'User ID is required' })
      return
    }
    try {
      // Capture user context for audit
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      // Update user via service
      const updatedUser = await userService.updateUser(id, req.body, user)
      if (!updatedUser) {
        res.status(404).json({ error: 'User not found' })
        return
      }
      res.json(updatedUser)
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to update user', { error: String(error) })
      res.status(500).json({ error: 'Failed to update user' })
    }
  }

  /**
   * Delete a user.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    // Validate ID
    if (!id) {
      res.status(400).json({ error: 'User ID is required' })
      return
    }
    try {
      // Capture user context for audit
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      // Delete user via service
      await userService.deleteUser(id, user)
      res.status(204).send()
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to delete user', { error: String(error) })
      res.status(500).json({ error: 'Failed to delete user' })
    }
  }

  /**
   * Get current authenticated user details.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      // Check authentication
      if (!req.user?.id) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      // Fetch user by ID
      const user = await userService.getUserById(req.user.id)
      if (!user) {
        res.status(404).json({ error: 'User not found' })
        return
      }
      res.json(user)
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to fetch current user', { error: String(error) })
      res.status(500).json({ error: 'Failed to fetch current user' })
    }
  }
}
