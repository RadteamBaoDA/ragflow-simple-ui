
/**
 * Routes for project API endpoints.
 */
import { Router } from 'express'
import { ProjectController } from '@/modules/projects/project.controller.js'
import { requireAuth, requireRole } from '@/shared/middleware/auth.middleware.js'

const router = Router()

// List projects (accessible by all authenticated users, filtered by permissions)
router.get('/', requireAuth, ProjectController.list)

// Get project by ID
router.get('/:id', requireAuth, ProjectController.getById)

// Create project (admin only)
router.post('/', requireRole('admin'), ProjectController.create)

// Update project (admin only)
router.put('/:id', requireRole('admin'), ProjectController.update)

// Delete project (admin only)
router.delete('/:id', requireRole('admin'), ProjectController.remove)

// Permission management (admin only)
router.get('/:id/permissions', requireRole('admin'), ProjectController.getPermissions)
router.post('/:id/permissions', requireRole('admin'), ProjectController.setPermission)
router.delete('/:id/permissions/:permissionId', requireRole('admin'), ProjectController.removePermission)

export default router
