/**
 * Admin controller: surfaces lightweight stats for the admin dashboard.
 * Extend with additional metrics as needed; keeps DB/service calls minimal.
 */
import { Request, Response } from 'express'
import { userService } from '@/services/user.service.js'
import { log } from '@/services/logger.service.js'

export class AdminController {
  /**
   * Get dashboard statistics.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      // Gather placeholder dashboard stats
      const stats = {
        // Count total users
        userCount: (await userService.getAllUsers()).length,
        // Add other stats as needed
      };
      res.json(stats);
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to fetch dashboard stats', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  }
}
