
import { Request, Response } from 'express';
import { minioService } from '@/services/minio.service.js';
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { getClientIp } from '@/utils/ip.js';

export class MinioBucketController {
    async getBuckets(req: Request, res: Response): Promise<void> {
        try {
            const buckets = await ModelFactory.minioBucket.findAll({}, { orderBy: { created_at: 'desc' } });
            res.json({ buckets });
        } catch (error) {
            log.error('Failed to fetch buckets', { error: String(error) });
            res.status(500).json({ error: 'Failed to fetch buckets' });
        }
    }

    async createBucket(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
            // Create in MinIO AND Database (service handles both via minioService.createBucket)
            const bucket = await minioService.createBucket(req.body.name, req.body.description, user);
            res.status(201).json({ bucket });
        } catch (error) {
            log.error('Failed to create bucket', { error: String(error) });
            res.status(500).json({ error: 'Failed to create bucket' });
        }
    }

    async deleteBucket(req: Request, res: Response): Promise<void> {
        const { name } = req.params;
        if (!name) {
            res.status(400).json({ error: 'Bucket name is required' });
            return;
        }
        try {
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
            await minioService.deleteBucket(name, user);
            res.status(204).send();
        } catch (error) {
            log.error('Failed to delete bucket', { error: String(error) });
            res.status(500).json({ error: 'Failed to delete bucket' });
        }
    }
}
