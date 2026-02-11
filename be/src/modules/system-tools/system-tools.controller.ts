/**
 * System tools controller: lists tools, reports health, and executes tools by id for operators.
 */
import { Request, Response } from 'express'
import { systemToolsService } from '@/modules/system-tools/system-tools.service.js'
import { log } from '@/shared/services/logger.service.js'

export class SystemToolsController {
  /**
   * Get list of available system tools.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getTools(req: Request, res: Response): Promise<void> {
    try {
      // Fetch tools from service
      const tools = await systemToolsService.getTools();
      res.json({ tools, count: tools.length });
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to fetch system tools', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch system tools' });
    }
  }

  /**
   * Get system health status.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      // Fetch health stats from service
      const health = await systemToolsService.getSystemHealth();
      res.json(health);
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to fetch system health', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch system health' });
    }
  }

  /**
   * Execute a specific system tool.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async runTool(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    // Validate tool ID
    if (!id) {
      res.status(400).json({ error: 'Tool ID is required' });
      return;
    }
    try {
      // Execute tool via service
      const result = await systemToolsService.runTool(id, req.body);
      res.json(result);
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to run system tool', { error: String(error) });
      res.status(500).json({ error: 'Failed to run system tool' });
    }
  }
}
