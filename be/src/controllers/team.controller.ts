/**
 * Team controller: CRUD for teams and membership management.
 * Ensures audit context (user/email/ip) is passed into service layer for logging.
 */
import { Request, Response } from 'express'
import { teamService } from '@/services/team.service.js'
import { log } from '@/services/logger.service.js'
import { getClientIp } from '@/utils/ip.js'

export class TeamController {
  /**
   * Get all teams.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getTeams(req: Request, res: Response): Promise<void> {
    try {
      // Fetch all teams from service
      const teams = await teamService.getAllTeams()
      res.json(teams)
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to fetch teams', { error: String(error) })
      res.status(500).json({ error: 'Failed to fetch teams' })
    }
  }

  /**
   * Create a new team.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async createTeam(req: Request, res: Response): Promise<void> {
    try {
      // Capture user context for audit
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      // Create team via service
      const team = await teamService.createTeam(req.body, user)
      res.status(201).json(team)
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to create team', { error: String(error) })
      res.status(500).json({ error: 'Failed to create team' })
    }
  }

  /**
   * Update an existing team.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async updateTeam(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    // Validate team ID
    if (!id) {
      res.status(400).json({ error: 'Team ID is required' })
      return
    }
    try {
      // Capture user context for audit
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      // Update team via service
      const team = await teamService.updateTeam(id, req.body, user)
      // Handle not found
      if (!team) {
        res.status(404).json({ error: 'Team not found' })
        return
      }
      res.json(team)
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to update team', { error: String(error) })
      res.status(500).json({ error: 'Failed to update team' })
    }
  }

  /**
   * Delete a team.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async deleteTeam(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    // Validate team ID
    if (!id) {
      res.status(400).json({ error: 'Team ID is required' })
      return
    }
    try {
      // Capture user context for audit
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      // Delete team via service
      await teamService.deleteTeam(id, user)
      res.status(204).send()
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to delete team', { error: String(error) })
      res.status(500).json({ error: 'Failed to delete team' })
    }
  }

  /**
   * Get members of a specific team.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getTeamMembers(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    // Validate team ID
    if (!id) {
      res.status(400).json({ error: 'Team ID is required' })
      return
    }
    try {
      // Fetch members from service
      const members = await teamService.getTeamMembers(id)
      res.json(members)
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to fetch team members', { error: String(error) })
      res.status(500).json({ error: 'Failed to fetch team members' })
    }
  }

  /**
   * Add members to a team.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<any>
   */
  async addMembers(req: Request, res: Response): Promise<any> {
    try {
      const teamId = req.params.id
      // Validate team ID
      if (!teamId) {
        return res.status(400).json({ error: 'Team ID is required' })
      }

      const { userId, userIds } = req.body
      const idsToAdd = userIds || (userId ? [userId] : [])

      if (idsToAdd.length === 0) {
        return res.status(400).json({ error: 'User ID(s) are required' })
      }

      // Capture user context for audit
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      // Add members via service
      await teamService.addMembersWithAutoRole(teamId, idsToAdd, user)
      return res.status(201).json({ message: 'Member(s) added successfully' })
    } catch (error: any) {
      const message = String(error.message || error)
      log.error('Error adding team member:', { error: message })

      // Handle specific business errors
      if (message.includes('Administrators cannot be added')) {
        return res.status(400).json({ error: 'Administrators cannot be added to teams' })
      }
      if (message.includes('No valid users found') || message.includes('User not found')) {
        return res.status(404).json({ error: message })
      }
      return res.status(500).json({ error: 'Failed to add team member' })
    }
  }

  /**
   * Remove a member from a team.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async removeMember(req: Request, res: Response): Promise<void> {
    const { id, userId } = req.params
    // Validate parameters
    if (!id || !userId) {
      res.status(400).json({ error: 'Team ID and User ID are required' })
      return
    }
    try {
      // Capture user context for audit
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      // Remove member via service
      await teamService.removeUserFromTeam(id, userId, user)
      res.status(204).send()
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to remove member from team', { error: String(error) })
      res.status(500).json({ error: 'Failed to remove member from team' })
    }
  }

  /**
   * Grant permissions to a team.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async grantPermissions(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { permissions } = req.body

    // Validate parameters
    if (!id) {
      res.status(400).json({ error: 'Team ID is required' })
      return
    }
    if (!permissions || !Array.isArray(permissions)) {
      res.status(400).json({ error: 'Permissions array is required' })
      return
    }

    try {
      // Capture user context for audit
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined
      // Grant permissions via service
      await teamService.grantPermissionsToTeam(id, permissions, user)
      res.json({ message: 'Permissions granted successfully' })
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to grant permissions to team', { error: String(error) })
      res.status(500).json({ error: 'Failed to grant permissions' })
    }
  }
}
