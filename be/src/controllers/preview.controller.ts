
import { Request, Response } from 'express';
import { previewService } from '@/services/preview.service.js';
import { log } from '@/services/logger.service.js';

export class PreviewController {
  async getPreview(req: Request, res: Response): Promise<void> {
    const { bucketName, fileName } = req.params;
    if (!bucketName || !fileName) {
      res.status(400).json({ error: 'Bucket name and file name are required' });
      return;
    }

    try {
      const previewPath = await previewService.generatePreview(bucketName, fileName);
      res.sendFile(previewPath);
    } catch (error) {
      log.error('Failed to generate preview', { error: String(error) });
      res.status(500).json({ error: 'Failed to generate preview' });
    }
  }
}
