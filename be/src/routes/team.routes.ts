import { Router } from 'express';
import { TeamController } from '@/controllers/team.controller.js';
import { requireAuth, requireRole, requirePermission } from '@/middleware/auth.middleware.js';
import { log } from '@/services/logger.service.js';

const router = Router();
const controller = new TeamController();

router.get('/', requirePermission('manage_users'), controller.getTeams.bind(controller));
router.post('/', requirePermission('manage_users'), controller.createTeam.bind(controller));
router.put('/:id', requirePermission('manage_users'), controller.updateTeam.bind(controller));
router.delete('/:id', requirePermission('manage_users'), controller.deleteTeam.bind(controller));
router.get('/:id/members', requirePermission('manage_users'), controller.getTeamMembers.bind(controller));
router.post('/:id/members', requirePermission('manage_users'), controller.addMembers.bind(controller));
router.delete('/:id/members/:userId', requirePermission('manage_users'), controller.removeMember.bind(controller));
router.post('/:id/permissions', requirePermission('manage_users'), controller.grantPermissions.bind(controller));

export default router;
