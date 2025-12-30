/**
 * Raw MinIO admin controller: direct access to buckets, stats, and service accounts (bypasses managed metadata).
 */
import { Request, Response } from 'express'
import { minioService } from '@/services/minio.service.js'
import { log } from '@/services/logger.service.js'

export class MinioRawController {
    /**
     * Get global MinIO metrics.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async getMetrics(req: Request, res: Response): Promise<void> {
        try {
            // Fetch global stats from service
            const stats = await minioService.getGlobalStats();
            res.json(stats);
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to get global metrics', { error });
            res.status(500).json({ error: 'Failed to fetch global metrics' });
        }
    }

    /**
     * List all buckets directly from MinIO.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async listBuckets(req: Request, res: Response): Promise<void> {
        try {
            // List buckets via service
            const buckets = await minioService.listBuckets();
            res.json({ buckets });
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to list raw MinIO buckets', {
                error: error instanceof Error ? error.message : String(error),
            });
            res.status(500).json({ error: 'Failed to list buckets' });
        }
    }

    /**
     * Get statistics for a specific bucket.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async getBucketStats(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.params;
            // Validate bucket name presence
            if (!name) {
                res.status(400).json({ error: 'Bucket name is required' });
                return;
            }
            // Fetch bucket stats via service
            const stats = await minioService.getBucketStats(name);
            res.json({ stats });
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to get bucket stats', {
                bucketName: req.params.name || 'unknown',
                error: error instanceof Error ? error.message : String(error),
            });
            res.status(500).json({ error: 'Failed to get bucket statistics' });
        }
    }

    /**
     * Create a new bucket directly in MinIO.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async createBucket(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.body;

            // Validate bucket name presence
            if (!name) {
                res.status(400).json({ error: 'Bucket name is required' });
                return;
            }

            // Validate bucket name format (MinIO constraints)
            const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{0,61}[a-z0-9]$/;
            if (!bucketNameRegex.test(name) || name.length < 3) {
                res.status(400).json({
                    error: 'Invalid bucket name. Must be 3-63 characters, lowercase, alphanumeric, hyphens, and dots only.',
                });
                return;
            }

            // Create bucket via service
            await minioService.createBucket(name, '', req.user);
            res.status(201).json({ message: 'Bucket created successfully' });
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to create raw bucket', {
                bucketName: req.body?.name || 'unknown',
                error: error instanceof Error ? error.message : String(error),
            });
            res.status(500).json({ error: 'Failed to create bucket. It may already exist.' });
        }
    }

    /**
     * Delete a bucket directly from MinIO.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async deleteBucket(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.params;
            // Validate bucket name presence
            if (!name) {
                res.status(400).json({ error: 'Bucket name is required' });
                return;
            }
            // Delete bucket via service
            await minioService.deleteBucket(name, req.user);
            res.json({ message: 'Bucket deleted successfully' });
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to delete raw bucket', {
                bucketName: req.params.name || 'unknown',
                error: error instanceof Error ? error.message : String(error),
            });
            res.status(500).json({ error: 'Failed to delete bucket. Ensure it is empty.' });
        }
    }

    /**
     * List all service accounts (access keys).
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async listKeys(req: Request, res: Response): Promise<void> {
        try {
            // List service accounts via service
            const keys = await minioService.listServiceAccounts();
            res.json({ keys });
        } catch (error: any) {
            // Log error and return 500 status
            log.error('Failed to list access keys', { message: error.message, stack: error.stack });
            res.status(500).json({ error: 'Failed to list access keys' });
        }
    }

    /**
     * Create a new service account (access key).
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async createKey(req: Request, res: Response): Promise<void> {
        try {
            const { policy, name, description } = req.body;
            // Create service account via service
            const result = await minioService.createServiceAccount(policy, name, description);
            res.json(result);
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to create access key', { error });
            res.status(500).json({ error: 'Failed to create access key' });
        }
    }

    /**
     * Delete a service account (access key).
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async deleteKey(req: Request, res: Response): Promise<void> {
        try {
            const { accessKey } = req.params;
            // Validate access key presence
            if (!accessKey) {
                res.status(400).json({ error: 'Access Key is required' });
                return; // Explicit return void
            }
            // Delete service account via service
            await minioService.deleteServiceAccount(accessKey);
            res.json({ message: 'Access key deleted successfully' });
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to delete access key', { error });
            res.status(500).json({ error: 'Failed to delete access key' });
        }
    }
}
