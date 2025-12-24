
import { Request, Response } from 'express';
import { minioService } from '../services/minio.service.js';
import { log } from '../services/logger.service.js';

export class MinioStorageController {
  async listFiles(req: Request, res: Response): Promise<void> {
    const { bucketName } = req.params;
    const prefix = req.query.prefix as string || '';

    if (!bucketName) {
        res.status(400).json({ error: 'Bucket name is required' });
        return;
    }

    try {
        const files = await minioService.listFiles(bucketName, prefix);
        res.json(files);
    } catch (error) {
        log.error('Failed to list files', { error: String(error) });
        res.status(500).json({ error: 'Failed to list files' });
    }
  }

  async uploadFile(req: Request, res: Response): Promise<void> {
    const { bucketName } = req.params;
    if (!bucketName) {
         res.status(400).json({ error: 'Bucket name is required' });
         return;
    }
    // File upload handling usually involves multer or similar middleware putting file in req.file
    // I need to verify how the route handles it.
    // Assuming req.file is populated.
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }

    try {
        const result = await minioService.uploadFile(bucketName, req.file, req.user?.id);
        res.status(201).json(result);
    } catch (error) {
        log.error('Failed to upload file', { error: String(error) });
        res.status(500).json({ error: 'Failed to upload file' });
    }
  }

  async downloadFile(req: Request, res: Response): Promise<void> {
    const { bucketName, fileName } = req.params;
    if (!bucketName || !fileName) {
        res.status(400).json({ error: 'Bucket name and file name are required' });
        return;
    }

    try {
        const stream = await minioService.getFileStream(bucketName, fileName);
        stream.pipe(res);
    } catch (error) {
        log.error('Failed to download file', { error: String(error) });
        res.status(500).json({ error: 'Failed to download file' });
    }
  }

  async deleteFile(req: Request, res: Response): Promise<void> {
    const { bucketName, fileName } = req.params;
    if (!bucketName || !fileName) {
        res.status(400).json({ error: 'Bucket name and file name are required' });
        return;
    }
    try {
        await minioService.deleteFile(bucketName, fileName, req.user?.id);
        res.status(204).send();
    } catch (error) {
        log.error('Failed to delete file', { error: String(error) });
        res.status(500).json({ error: 'Failed to delete file' });
    }
  }
}
