/**
 * Audit controller: exposes paginated audit logs and metadata (actions/resource types).
 * All routes are protected at router level to admin-only; this layer focuses on validation and shaping filters.
 */
import { Request, Response } from 'express'
import { auditService } from '@/services/audit.service.js'
import { log } from '@/services/logger.service.js'

export class AuditController {
  /**
   * Get filtered and paginated audit logs.
   * @param req - Express request object containing query filters.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getLogs(req: Request, res: Response): Promise<void> {
    try {
      // Safely extract and validate query parameters
      const page = this.getStringParam(req.query.page) || '1';
      const limit = this.getStringParam(req.query.limit) || '50';
      const userId = this.getStringParam(req.query.userId);
      const action = this.getStringParam(req.query.action);
      const resourceType = this.getStringParam(req.query.resourceType);
      const startDate = this.getStringParam(req.query.startDate);
      const endDate = this.getStringParam(req.query.endDate);
      const search = this.getStringParam(req.query.search);

      // Parse and validate pagination params
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      // Calculate offset from page number
      const offset = (pageNum - 1) * limitNum;

      // Build filters object (without pagination)
      const filters: Record<string, string> = {};
      if (userId) filters.userId = userId;
      if (action) filters.action = action;
      if (resourceType) filters.resourceType = resourceType;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (search) filters.search = search;

      // Fetch logs from service with filters (pass limit and offset as separate params)
      const result = await auditService.getLogs(filters, limitNum, offset);

      // Debug log for audit fetch
      log.debug('Audit logs fetched', {
        page: pageNum,
        limit: limitNum,
        offset,
        total: result.pagination.total,
        requestedBy: req.session?.user?.email,
      });

      res.json(result);
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to fetch audit logs', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }

  /**
   * Get available action types for filtering.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getActions(req: Request, res: Response): Promise<void> {
    try {
      // Fetch action types from service
      const actions = await auditService.getActionTypes();
      res.json(actions);
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to fetch action types', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to fetch action types' });
    }
  }

  /**
   * Get available resource types for filtering.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getResourceTypes(req: Request, res: Response): Promise<void> {
    try {
      // Fetch resource types from service
      const resourceTypes = await auditService.getResourceTypes();
      res.json(resourceTypes);
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to fetch resource types', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to fetch resource types' });
    }
  }

  /**
   * Get history for a specific resource.
   * @param req - Express request object containing route parameters.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getResourceHistory(req: Request, res: Response): Promise<void> {
    const { type, id } = req.params;
    // Validate required parameters
    if (!type || !id) {
      res.status(400).json({ error: 'Resource type and ID are required' });
      return;
    }

    try {
      // Fetch resource history from service
      const logs = await auditService.getResourceHistory(type, id);
      res.json(logs);
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to fetch resource history', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch resource history' });
    }
  }

  /**
   * Export audit logs to CSV.
   * @param req - Express request object containing query filters.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async exportLogs(req: Request, res: Response): Promise<void> {
    try {
      // Build filter object from query parameters
      const filters: any = {};
      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.action) filters.action = req.query.action as string;
      if (req.query.resourceType) filters.resourceType = req.query.resourceType as string;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      // Generate CSV from service
      const csv = await auditService.exportLogsToCsv(filters);

      // Set headers for CSV download
      res.header('Content-Type', 'text/csv');
      res.attachment(`audit-logs-${new Date().toISOString()}.csv`);
      res.send(csv);
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to export audit logs', { error: String(error) });
      res.status(500).json({ error: 'Failed to export audit logs' });
    }
  }

  /**
   * Helper to safely extract string parameters from unknown input.
   * @param value - The value to check.
   * @returns string | undefined
   */
  private getStringParam(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }
    // Handle array case (e.g., duplicated query params)
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
      return value[0]; // Take first value if array
    }
    return undefined;
  }
}
