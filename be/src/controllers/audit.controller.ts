
import { Request, Response } from 'express';
import { auditService } from '@/services/audit.service.js';
import { log } from '@/services/logger.service.js';

export class AuditController {
  async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const filters: any = {};
      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.action) filters.action = req.query.action as string;
      if (req.query.resourceType) filters.resourceType = req.query.resourceType as string;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      const result = await auditService.getLogs(filters, limit, offset);
      res.json(result);
    } catch (error) {
      log.error('Failed to fetch audit logs', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch audit logs' });
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
}
