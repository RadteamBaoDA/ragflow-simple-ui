
import { Request, Response, NextFunction } from 'express';
import { queueService } from '@/services/queue.service.js';
import { log } from '@/services/logger.service.js';

export class ExternalHistoryController {
  async collectChatHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { session_id, user_id, messages } = req.body;

      if (!session_id || !Array.isArray(messages)) {
        res.status(400).json({ error: 'Invalid request: session_id and messages array are required' });
        return;
      }

      await queueService.addChatHistoryJob({
        sessionId: session_id,
        userId: user_id,
        messages: messages.map((msg: any) => ({
          prompt: msg.prompt,
          response: msg.response,
          citations: msg.citations
        }))
      });

      res.status(202).json({ message: 'Chat history queued for processing' });
    } catch (error) {
      log.error('Error queuing chat history', { error });
      next(error);
    }
  }

  async collectSearchHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { session_id, user_id, query, summary, results } = req.body;

      if (!session_id || !query) {
        res.status(400).json({ error: 'Invalid request: session_id and query are required' });
        return;
      }

      await queueService.addSearchHistoryJob({
        sessionId: session_id,
        userId: user_id,
        query,
        summary,
        results
      });

      res.status(202).json({ message: 'Search history queued for processing' });
    } catch (error) {
      log.error('Error queuing search history', { error });
      next(error);
    }
  }
}
