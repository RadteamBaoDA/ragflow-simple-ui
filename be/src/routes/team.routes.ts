
/**
 * Team Routes
 * Manages team lifecycle and membership.
 */
import { Router } from 'express'
import { TeamController } from '@/controllers/team.controller.js'
import { requirePermission } from '@/middleware/auth.middleware.js'

const router = Router()
const controller = new TeamController()

/**
 * @route GET /api/teams
 * @description List all teams.
 * @access Private (Manage Users)
 */
// List all teams for administration
router.get('/', requirePermission('manage_users'), controller.getTeams.bind(controller))

/**
 * @route POST /api/teams
 * @description Create a new team shell with optional metadata.
 * @access Private (Manage Users)
 */
// Create new team group
router.post('/', requirePermission('manage_users'), controller.createTeam.bind(controller))

/**
 * @route PUT /api/teams/:id
 * @description Update team name/metadata.
 * @access Private (Manage Users)
 */
// Update team details
router.put('/:id', requirePermission('manage_users'), controller.updateTeam.bind(controller))

/**
 * @route DELETE /api/teams/:id
 * @description Delete a team (cascades member cleanup in service layer).
 * @access Private (Manage Users)
 */
// Delete team and clean up memberships
router.delete('/:id', requirePermission('manage_users'), controller.deleteTeam.bind(controller))

/**
 * @route GET /api/teams/:id/members
 * @description Retrieve current team members.
 * @access Private (Manage Users)
 */
// List users belonging to a team
router.get('/:id/members', requirePermission('manage_users'), controller.getTeamMembers.bind(controller))

/**
 * @route POST /api/teams/:id/members
 * @description Add members to a team.
 * @access Private (Manage Users)
 */
// Assign users to a team
router.post('/:id/members', requirePermission('manage_users'), controller.addMembers.bind(controller))

/**
 * @route DELETE /api/teams/:id/members/:userId
 * @description Remove a member from a team.
 * @access Private (Manage Users)
 */
// Remove user from team
router.delete('/:id/members/:userId', requirePermission('manage_users'), controller.removeMember.bind(controller))

/**
 * @route POST /api/teams/:id/permissions
 * @description Grant team-level permissions (stored per-team).
 * @access Private (Manage Users)
 */
// Update team capability flags
router.post('/:id/permissions', requirePermission('manage_users'), controller.grantPermissions.bind(controller))

export default router
