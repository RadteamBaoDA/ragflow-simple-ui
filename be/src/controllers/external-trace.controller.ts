
import { Request, Response } from 'express';
import { externalTraceService } from '@/services/external-trace.service.js';
import { log } from '@/services/logger.service.js';

export class ExternalTraceController {
  async submitTrace(req: Request, res: Response): Promise<void> {
    try {
      const result = await externalTraceService.processTrace(req.body);
      res.json(result);
    } catch (error) {
      log.error('Failed to submit trace', { error: String(error) });
      res.status(500).json({ error: 'Failed to submit trace' });
    }
  }

  async submitFeedback(req: Request, res: Response): Promise<void> {
    try {
      const result = await externalTraceService.processFeedback(req.body);
      res.json(result);
    } catch (error) {
      log.error('Failed to submit feedback', { error: String(error) });
      res.status(500).json({ error: 'Failed to submit feedback' });
    }
  }
}
