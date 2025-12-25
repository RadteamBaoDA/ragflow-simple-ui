/**
 * External trace controller: accepts Langfuse-compatible traces and feedback from external clients.
 */
import { Request, Response } from 'express'
import { externalTraceService } from '@/services/external/trace.service.js'
import { log } from '@/services/logger.service.js'

export class ExternalTraceController {
  /**
   * Submit a trace
   * @param req 
   * @param res 
   */
  async submitTrace(req: Request, res: Response): Promise<void> {
    try {
      const result = await externalTraceService.processTrace(req.body);
      log.debug('Trace submitted successfully', { result });
      res.json(result);
    } catch (error) {
      log.error('Failed to submit trace', { error: String(error) });
      res.status(500).json({ error: 'Failed to submit trace' });
    }
  }

  /**
   * Submit feedback for a trace
   * @param req 
   * @param res 
   */
  async submitFeedback(req: Request, res: Response): Promise<void> {
    try {
      const result = await externalTraceService.processFeedback(req.body);
      log.debug('Feedback submitted successfully', { result });
      res.json(result);
    } catch (error) {
      log.error('Failed to submit feedback', { error: String(error) });
      res.status(500).json({ error: 'Failed to submit feedback' });
    }
  }

  /**
   * Get health of the external trace service
   * @param _req 
   * @param res 
   */
  async getHealth(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'ok',
      service: 'external-trace',
      timestamp: new Date().toISOString()
    });
  }
}
