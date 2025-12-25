import { Router } from 'express'
import { TeamController } from '@/controllers/team.controller.js'
import { requirePermission } from '@/middleware/auth.middleware.js'

const router = Router()
const controller = new TeamController()

// List all teams
router.get('/', requirePermission('manage_users'), controller.getTeams.bind(controller))
// Create a new team shell with optional metadata
router.post('/', requirePermission('manage_users'), controller.createTeam.bind(controller))
// Update team name/metadata
router.put('/:id', requirePermission('manage_users'), controller.updateTeam.bind(controller))
// Delete a team (cascades member cleanup in service layer)
router.delete('/:id', requirePermission('manage_users'), controller.deleteTeam.bind(controller))
// Retrieve current team members
router.get('/:id/members', requirePermission('manage_users'), controller.getTeamMembers.bind(controller))
// Add members to a team
router.post('/:id/members', requirePermission('manage_users'), controller.addMembers.bind(controller))
// Remove a member from a team
router.delete('/:id/members/:userId', requirePermission('manage_users'), controller.removeMember.bind(controller))
// Grant team-level permissions (stored per-team)
router.post('/:id/permissions', requirePermission('manage_users'), controller.grantPermissions.bind(controller))

export default router
