
/**
 * Admin Routes
 * Defines operational endpoints restricted to system administrators.
 */
import { Router } from 'express'
import { AdminController } from '@/modules/admin/admin.controller.js'
import { requireRole } from '@/shared/middleware/auth.middleware.js'

const router = Router()
const controller = new AdminController()

/**
 * @route GET /api/admin/dashboard
 * @description Retrieve high-level system statistics for the admin dashboard.
 * @access Private (Admin only)
 */
// Protect route with role check middleware to ensure only 'admin' users can access
router.get('/dashboard', requireRole('admin'), controller.getDashboardStats.bind(controller))

export default router
