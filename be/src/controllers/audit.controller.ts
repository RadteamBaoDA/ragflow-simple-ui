/**
 * Audit controller: exposes paginated audit logs and metadata (actions/resource types).
 * All routes are protected at router level to admin-only; this layer focuses on validation and shaping filters.
 */
import { Request, Response } from 'express'
import { auditService } from '@/services/audit.service.js'
import { log } from '@/services/logger.service.js'

export class AuditController {
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

        const result = await auditService.getLogs({
            page: pageNum,
            limit: limitNum,
            ...(userId && { userId }),
            ...(action && { action }),
            ...(resourceType && { resourceType }),
            ...(startDate && { startDate }),
            ...(endDate && { endDate }),
            ...(search && { search }),
        });

        log.debug('Audit logs fetched', {
            page: pageNum,
            limit: limitNum,
            total: result.pagination.total,
            requestedBy: req.session?.user?.email,
        });

        res.json(result);
    } catch (error) {
        log.error('Failed to fetch audit logs', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }

  async getActions(req: Request, res: Response): Promise<void> {
    try {
        const actions = await auditService.getActionTypes();
        res.json(actions);
    } catch (error) {
        log.error('Failed to fetch action types', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to fetch action types' });
    }
  }

  async getResourceTypes(req: Request, res: Response): Promise<void> {
    try {
        const resourceTypes = await auditService.getResourceTypes();
        res.json(resourceTypes);
    } catch (error) {
        log.error('Failed to fetch resource types', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to fetch resource types' });
    }
  }

  async getResourceHistory(req: Request, res: Response): Promise<void> {
    const { type, id } = req.params;
    if (!type || !id) {
      res.status(400).json({ error: 'Resource type and ID are required' });
      return;
    }

    try {
      const logs = await auditService.getResourceHistory(type, id);
      res.json(logs);
    } catch (error) {
      log.error('Failed to fetch resource history', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch resource history' });
    }
  }

  async exportLogs(req: Request, res: Response): Promise<void> {
    try {
      const filters: any = {};
      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.action) filters.action = req.query.action as string;
      if (req.query.resourceType) filters.resourceType = req.query.resourceType as string;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      const csv = await auditService.exportLogsToCsv(filters);

      res.header('Content-Type', 'text/csv');
      res.attachment(`audit-logs-${new Date().toISOString()}.csv`);
      res.send(csv);
    } catch (error) {
      log.error('Failed to export audit logs', { error: String(error) });
      res.status(500).json({ error: 'Failed to export audit logs' });
    }
  }

  private getStringParam(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        return value[0]; // Take first value if array
    }
    return undefined;
  }
}
