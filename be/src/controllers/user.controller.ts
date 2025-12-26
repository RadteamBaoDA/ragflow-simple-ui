/**
 * User controller: manages user CRUD, role/permission changes, and IP history access.
 * Emphasizes IDOR prevention (ownership/role checks occur in middleware) and audit logging for sensitive updates.
 */
import { Request, Response } from 'express'
import { userService } from '@/services/user.service.js'
import { log } from '@/services/logger.service.js'
import { getClientIp } from '@/utils/ip.js'
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js'

export class UserController {
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      // Optional roles filter lets UI fetch scoped lists without extra endpoints
      const roles = req.query.roles ? (req.query.roles as string).split(',') : undefined
      const users = await userService.getAllUsers(roles as any)
      res.json(users)
    } catch (error) {
      log.error('Failed to fetch users', { error: String(error) })
      res.status(500).json({ error: 'Failed to fetch users' })
    }
  }

  async getAllIpHistory(req: Request, res: Response): Promise<void> {
    try {
      const historyMap = await userService.getAllUsersIpHistory()
      // Convert Map to plain object for JSON serialization
      const historyObject: Record<string, any[]> = {}
      for (const [userId, history] of historyMap.entries()) {
        historyObject[userId] = history
      }
      res.json(historyObject)
    } catch (error) {
      log.error('Failed to fetch IP history', { error: error instanceof Error ? error.message : String(error) })
      res.status(500).json({ error: 'Failed to fetch IP history' })
    }
  }

  async getUserIpHistory(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'User ID is required' })
      return
    }

    try {
      const history = await userService.getUserIpHistory(id)
      res.json(history)
    } catch (error) {
      log.error('Failed to fetch user IP history', { error: error instanceof Error ? error.message : String(error), userId: id })
      res.status(500).json({ error: 'Failed to fetch IP history' })
    }
  }

  async updateUserRole(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { role } = req.body

    // Ensure input is string
    if (typeof id !== 'string' || typeof role !== 'string') {
      res.status(400).json({ error: 'Invalid input' })
      return
    }

    try {
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

      const updatedUser = await userService.updateUserRole(id, role, actor)

      if (!updatedUser) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      res.json(updatedUser)
    } catch (error: any) {
      const message = error.message || String(error);
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

  async updateUserPermissions(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { permissions } = req.body

    if (!id) {
      res.status(400).json({ error: 'User ID is required' })
      return
    }

    if (!Array.isArray(permissions)) {
      res.status(400).json({ error: 'Permissions must be an array of strings' })
      return
    }

    try {
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      await userService.updateUserPermissions(id, permissions, user)
      res.json({ success: true })
    } catch (error) {
      log.error('Failed to update user permissions', { userId: id, error: String(error) })
      res.status(500).json({ error: 'Failed to update user permissions' })
    }
  }

  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      const newUser = await userService.createUser(req.body, user)
      res.status(201).json(newUser)
    } catch (error) {
      log.error('Failed to create user', { error: String(error) })
      res.status(500).json({ error: 'Failed to create user' })
    }
  }

  async updateUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    if (!id) {
      res.status(400).json({ error: 'User ID is required' })
      return
    }
    try {
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      const updatedUser = await userService.updateUser(id, req.body, user)
      if (!updatedUser) {
        res.status(404).json({ error: 'User not found' })
        return
      }
      res.json(updatedUser)
    } catch (error) {
      log.error('Failed to update user', { error: String(error) })
      res.status(500).json({ error: 'Failed to update user' })
    }
  }

  async deleteUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    if (!id) {
      res.status(400).json({ error: 'User ID is required' })
      return
    }
    try {
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      await userService.deleteUser(id, user)
      res.status(204).send()
    } catch (error) {
      log.error('Failed to delete user', { error: String(error) })
      res.status(500).json({ error: 'Failed to delete user' })
    }
  }

  async getMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      const user = await userService.getUserById(req.user.id)
      if (!user) {
        res.status(404).json({ error: 'User not found' })
        return
      }
      res.json(user)
    } catch (error) {
      log.error('Failed to fetch current user', { error: String(error) })
      res.status(500).json({ error: 'Failed to fetch current user' })
    }
  }
}
