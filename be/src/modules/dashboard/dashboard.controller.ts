
/**
 * Dashboard Controller
 * Handles admin requests for activity dashboard statistics.
 * @module controllers/dashboard
 */
import { Request, Response } from 'express'
import { log } from '@/shared/services/logger.service.js'
import { dashboardService } from '@/modules/dashboard/dashboard.service.js'

/**
 * DashboardController
 * Exposes endpoint for fetching aggregated dashboard statistics.
 */
export class DashboardController {
  /**
   * Get dashboard statistics with optional date range filtering.
   * @param req - Express request with optional startDate/endDate query params
   * @param res - Express response returning DashboardStats JSON
   * @returns Promise<void>
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      // Parse optional date range from query parameters
      const startDate = req.query.startDate as string || undefined
      const endDate = req.query.endDate as string || undefined

      // Fetch aggregated stats from service
      const stats = await dashboardService.getStats(startDate, endDate)
      res.json(stats)
    } catch (error) {
      // Log error details and return 500 status
      log.error('Error fetching dashboard stats', error as Record<string, unknown>)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}
