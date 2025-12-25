import { Router } from 'express'
import { requireAuth, requireRole } from '@/middleware/auth.middleware.js'
import { DocumentPermissionController } from '@/controllers/document-permission.controller.js'

const router = Router()
const controller = new DocumentPermissionController()

// Require authentication for all routes
router.use(requireAuth)

/**
 * GET /api/document-permissions
 * Get all configured permissions
 * @requires admin role
 */
router.get('/', requireRole('admin'), controller.getAllPermissions.bind(controller))

/**
 * POST /api/document-permissions
 * Set permission for an entity
 * Security: Only admins can grant document permissions, and only to leaders (admins have full access by default)
 * @requires admin role
 */
router.post('/', requireRole('admin'), controller.setPermission.bind(controller))

/**
 * GET /api/document-permissions/resolve
 * Get effective permission for current user
 */
router.get('/resolve', controller.resolveUserPermission.bind(controller))

export default router
