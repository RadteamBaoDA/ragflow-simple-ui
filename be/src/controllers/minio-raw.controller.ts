
import { Request, Response } from 'express';
import { minioService } from '@/services/minio.service.js';
import { log } from '@/services/logger.service.js';

export class MinioRawController {
    async getMetrics(req: Request, res: Response): Promise<void> {
        try {
            const stats = await minioService.getGlobalStats();
            res.json(stats);
        } catch (error) {
            log.error('Failed to get global metrics', { error });
            res.status(500).json({ error: 'Failed to fetch global metrics' });
        }
    }

    async listBuckets(req: Request, res: Response): Promise<void> {
        try {
            const buckets = await minioService.listBuckets();
            res.json({ buckets });
        } catch (error) {
            log.error('Failed to list raw MinIO buckets', {
                error: error instanceof Error ? error.message : String(error),
            });
            res.status(500).json({ error: 'Failed to list buckets' });
        }
    }

    async getBucketStats(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.params;
            if (!name) {
                res.status(400).json({ error: 'Bucket name is required' });
                return;
            }
            const stats = await minioService.getBucketStats(name);
            res.json({ stats });
        } catch (error) {
            log.error('Failed to get bucket stats', {
                bucketName: req.params.name || 'unknown',
                error: error instanceof Error ? error.message : String(error),
            });
            res.status(500).json({ error: 'Failed to get bucket statistics' });
        }
    }

    async createBucket(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.body;

            if (!name) {
                res.status(400).json({ error: 'Bucket name is required' });
                return;
            }

            const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
            if (!bucketNameRegex.test(name)) {
                res.status(400).json({
                    error: 'Invalid bucket name. Must be 3-63 characters, lowercase, alphanumeric, hyphens, and dots only.',
                });
                return;
            }

            await minioService.createBucket(name, '', undefined);
            res.status(201).json({ message: 'Bucket created successfully' });
        } catch (error) {
            log.error('Failed to create raw bucket', {
                bucketName: req.body?.name || 'unknown',
                error: error instanceof Error ? error.message : String(error),
            });
            res.status(500).json({ error: 'Failed to create bucket. It may already exist.' });
        }
    }

    async deleteBucket(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.params;
            if (!name) {
                res.status(400).json({ error: 'Bucket name is required' });
                return;
            }
            await minioService.deleteBucket(name);
            res.json({ message: 'Bucket deleted successfully' });
        } catch (error) {
            log.error('Failed to delete raw bucket', {
                bucketName: req.params.name || 'unknown',
                error: error instanceof Error ? error.message : String(error),
            });
            res.status(500).json({ error: 'Failed to delete bucket. Ensure it is empty.' });
        }
    }

    async listKeys(req: Request, res: Response): Promise<void> {
        try {
            const keys = await minioService.listServiceAccounts();
            res.json({ keys });
        } catch (error: any) {
            log.error('Failed to list access keys', { message: error.message, stack: error.stack });
            res.status(500).json({ error: 'Failed to list access keys' });
        }
    }

    async createKey(req: Request, res: Response): Promise<void> {
        try {
            const { policy, name, description } = req.body;
            const result = await minioService.createServiceAccount(policy, name, description);
            res.json(result);
        } catch (error) {
            log.error('Failed to create access key', { error });
            res.status(500).json({ error: 'Failed to create access key' });
        }
    }

    async deleteKey(req: Request, res: Response): Promise<void> {
        try {
            const { accessKey } = req.params;
            if (!accessKey) {
                res.status(400).json({ error: 'Access Key is required' });
                return; // Explicit return void
            }
            await minioService.deleteServiceAccount(accessKey);
            res.json({ message: 'Access key deleted successfully' });
        } catch (error) {
            log.error('Failed to delete access key', { error });
            res.status(500).json({ error: 'Failed to delete access key' });
        }
    }
}
