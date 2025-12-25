/**
 * Admin controller: surfaces lightweight stats for the admin dashboard.
 * Extend with additional metrics as needed; keeps DB/service calls minimal.
 */
import { Request, Response } from 'express'
import { userService } from '@/services/user.service.js'
import { log } from '@/services/logger.service.js'

export class AdminController {
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      // Placeholder for dashboard stats
      const stats = {
        userCount: (await userService.getAllUsers()).length,
        // Add other stats as needed
      };
      res.json(stats);
    } catch (error) {
      log.error('Failed to fetch dashboard stats', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  }
}
