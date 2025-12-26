
/**
 * Document Permission Routes
 * Manages fine-grained access control for documents/buckets.
 */
import { Router } from 'express'
import { requireAuth, requireRole } from '@/middleware/auth.middleware.js'
import { DocumentPermissionController } from '@/controllers/document-permission.controller.js'

const router = Router()
const controller = new DocumentPermissionController()

// Require authentication for all routes
router.use(requireAuth)

/**
 * @route GET /api/document-permissions
 * @description Get all configured permissions
 * @access Private (Admin only)
 */
// Restricted to admin usage for listing all system permissions
router.get('/', requireRole('admin'), controller.getAllPermissions.bind(controller))

/**
 * @route POST /api/document-permissions
 * @description Set permission for an entity (user or team) on a bucket.
 * Security: Only admins can grant document permissions.
 * @access Private (Admin only)
 */
// Restricted to admin usage for modifying permissions
router.post('/', requireRole('admin'), controller.setPermission.bind(controller))

/**
 * @route GET /api/document-permissions/resolve
 * @description Get effective permission for current user on a bucket.
 * @access Private
 */
// Open to all authenticated users to check their own access
router.get('/resolve', controller.resolveUserPermission.bind(controller))

export default router
