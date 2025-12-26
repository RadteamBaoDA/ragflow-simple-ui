/**
 * Preview controller: generates lightweight previews for stored documents before download.
 */
import { Request, Response } from 'express'
import { previewService } from '@/services/preview.service.js'
import { log } from '@/services/logger.service.js'

export class PreviewController {
  /**
   * Get document preview by bucket and filename.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise<void>
   */
  async getPreview(req: Request, res: Response): Promise<void> {
    const { bucketName, fileName } = req.params;
    // Validate parameters
    if (!bucketName || !fileName) {
      res.status(400).json({ error: 'Bucket name and file name are required' });
      return;
    }

    try {
      // Generate preview via service
      const previewPath = await previewService.generatePreview(bucketName, fileName);
      // Send the preview file itself
      res.sendFile(previewPath);
    } catch (error) {
      // Log error and return 500 status
      log.error('Failed to generate preview', { error: String(error) });
      res.status(500).json({ error: 'Failed to generate preview' });
    }
  }
}
