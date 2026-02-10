
/**
 * Dashboard Routes
 * Admin-only endpoints for activity dashboard statistics.
 * @module routes/dashboard
 */
import { Router } from 'express'
import { DashboardController } from '@/controllers/dashboard.controller.js'
import { requireAuth, requireRole } from '@/middleware/auth.middleware.js'

const router = Router()
const controller = new DashboardController()

/**
 * @route GET /api/admin/dashboard/stats
 * @description Retrieve aggregated dashboard statistics (sessions, messages, trends, top users).
 * @access Private (Admin, Leader)
 * @query startDate - Optional ISO date string for range start
 * @query endDate - Optional ISO date string for range end
 */
router.get(
  '/stats',
  requireAuth,
  requireRole('admin', 'leader'),
  controller.getStats.bind(controller)
)

export default router
