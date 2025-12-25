/**
 * External trace controller: accepts Langfuse-compatible traces and feedback from external clients.
 * 
 * Force adds server-side IP address using getClientIp() utility for accurate tracking.
 */
import { Request, Response } from 'express'
import { externalTraceService } from '@/services/external/trace.service.js'
import { log } from '@/services/logger.service.js'
import { getClientIp } from '@/utils/ip.js'

export class ExternalTraceController {
  /**
   * Submit a trace.
   * Force adds ipAddress from server-side detection using getClientIp().
   */
  async submitTrace(req: Request, res: Response): Promise<void> {
    try {
      // Force add server-side IP address for accurate tracking
      const ipAddress = getClientIp(req)
      const traceData = {
        ...req.body,
        ipAddress // Override or add ipAddress from server-side detection
      }

      const result = await externalTraceService.processTrace(traceData);
      log.debug('Trace submitted successfully', { result, ipAddress });
      res.json(result);
    } catch (error) {
      log.error('Failed to submit trace', { error: String(error) });
      res.status(500).json({ error: 'Failed to submit trace' });
    }
  }

  /**
   * Submit feedback for a trace.
   * Force adds ipAddress from server-side detection using getClientIp().
   */
  async submitFeedback(req: Request, res: Response): Promise<void> {
    try {
      // Force add server-side IP address for accurate tracking
      const ipAddress = getClientIp(req)
      const feedbackData = {
        ...req.body,
        ipAddress // Override or add ipAddress from server-side detection
      }

      const result = await externalTraceService.processFeedback(feedbackData);
      log.debug('Feedback submitted successfully', { result, ipAddress });
      res.json(result);
    } catch (error) {
      log.error('Failed to submit feedback', { error: String(error) });
      res.status(500).json({ error: 'Failed to submit feedback' });
    }
  }

  /**
   * Get health of the external trace service
   */
  async getHealth(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'ok',
      service: 'external-trace',
      timestamp: new Date().toISOString()
    });
  }
}
