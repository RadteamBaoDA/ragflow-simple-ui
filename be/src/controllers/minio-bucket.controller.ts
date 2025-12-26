/**
 * Managed MinIO bucket controller: exposes buckets visible to a user, plus create/delete operations for managers.
 * Contains inline notes about permission fallback paths; consider refactoring with shared RBAC helper.
 */
import { Request, Response } from 'express'
import { log } from '@/services/logger.service.js'
import { getClientIp } from '@/utils/ip.js'
import { minioBucketService } from '@/services/minio-bucket.service.js'

export class MinioBucketController {
    async getBuckets(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const buckets = await minioBucketService.getAccessibleBuckets(user);
            res.json({ buckets });
        } catch (error) {
            log.error('Failed to fetch buckets', { error: String(error) });
            res.status(500).json({ error: 'Failed to fetch buckets' });
        }
    }

    async getAvailableBuckets(req: Request, res: Response): Promise<void> {
        try {
            const buckets = await minioBucketService.getAvailableBuckets();
            res.json({ buckets });
        } catch (error) {
            log.error('Failed to fetch available buckets', { error: String(error) });
            res.status(500).json({ error: 'Failed to fetch available buckets' });
        }
    }

    async createBucket(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : { id: 'system', email: 'system' };
            const bucket = await minioBucketService.createBucket(req.body.bucket_name, req.body.description, user);
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
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : { id: 'system', email: 'system' };
            await minioBucketService.deleteBucket(name, user);
            res.status(204).send();
        } catch (error) {
            log.error('Failed to delete bucket', { error: String(error) });
            res.status(500).json({ error: 'Failed to delete bucket' });
        }
    }
}
