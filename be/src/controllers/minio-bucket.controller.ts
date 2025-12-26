/**
 * Managed MinIO bucket controller: exposes buckets visible to a user, plus create/delete operations for managers.
 * Contains inline notes about permission fallback paths; consider refactoring with shared RBAC helper.
 */
import { Request, Response } from 'express'
import { log } from '@/services/logger.service.js'
import { getClientIp } from '@/utils/ip.js'
import { minioBucketService } from '@/services/minio-bucket.service.js'

export class MinioBucketController {
    /**
     * Get buckets accessible to the current user.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async getBuckets(req: Request, res: Response): Promise<void> {
        try {
            // Validate authentication
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // Fetch accessible buckets from service
            const buckets = await minioBucketService.getAccessibleBuckets(user);
            res.json({ buckets });
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to fetch buckets', { error: String(error) });
            res.status(500).json({ error: 'Failed to fetch buckets' });
        }
    }

    /**
     * Get list of all available buckets (Admin/Manager).
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async getAvailableBuckets(req: Request, res: Response): Promise<void> {
        try {
            // Fetch all available buckets from service
            const buckets = await minioBucketService.getAvailableBuckets();
            res.json({ buckets });
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to fetch available buckets', { error: String(error) });
            res.status(500).json({ error: 'Failed to fetch available buckets' });
        }
    }

    /**
     * Create a new MinIO bucket.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async createBucket(req: Request, res: Response): Promise<void> {
        try {
            // Capture user context or default to system
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : { id: 'system', email: 'system' };
            // Create bucket via service
            const bucket = await minioBucketService.createBucket(req.body.bucket_name, req.body.description, user);
            res.status(201).json({ bucket });
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to create bucket', { error: String(error) });
            res.status(500).json({ error: 'Failed to create bucket' });
        }
    }

    /**
     * Delete a MinIO bucket.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async deleteBucket(req: Request, res: Response): Promise<void> {
        const { name } = req.params;
        // Validate bucket name presence
        if (!name) {
            res.status(400).json({ error: 'Bucket name is required' });
            return;
        }
        try {
            // Capture user context or default to system
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : { id: 'system', email: 'system' };
            // Delete bucket via service
            await minioBucketService.deleteBucket(name, user);
            res.status(204).send();
        } catch (error) {
            // Log error and return 500 status
            log.error('Failed to delete bucket', { error: String(error) });
            res.status(500).json({ error: 'Failed to delete bucket' });
        }
    }
}
