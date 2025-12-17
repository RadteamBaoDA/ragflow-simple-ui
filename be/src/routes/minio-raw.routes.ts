/**
 * @fileoverview Raw MinIO bucket operations for Admin Dashboard.
 * 
 * This module provides direct access to MinIO for administrative tasks,
 * bypassing the application's internal bucket configuration database.
 * 
 * Features:
 * - List all buckets in MinIO
 * - Get bucket statistics (size, object count)
 * - Create new buckets directly
 * - Delete buckets (must be empty)
 * 
 * @module routes/minio-raw
 */

import { Router, Request, Response } from 'express';
import { minioService } from '../services/minio.service.js';
import { log } from '../services/logger.service.js';
import { requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Get global metrics
router.get('/metrics', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const stats = await minioService.getGlobalStats();
        res.json(stats);
    } catch (error) {
        log.error('Failed to get global metrics', { error });
        res.status(500).json({ error: 'Failed to fetch global metrics' });
    }
});

/**
 * GET /api/minio/raw
 * List all buckets directly from MinIO.
 * 
 * @requires admin role
 */
// List all buckets
router.get('/', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const buckets = await minioService.listBuckets();
        res.json({ buckets });
    } catch (error) {
        log.error('Failed to list raw MinIO buckets', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to list buckets' });
    }
});

/**
 * GET /api/minio/raw/:name/stats
 * Get usage statistics for a specific bucket.
 * 
 * @requires admin role
 * @param {string} name - Bucket name
 */
router.get('/:name/stats', requireRole('admin'), async (req: Request, res: Response) => {
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
});

/**
 * POST /api/minio/raw
 * Create a new bucket in MinIO.
 * 
 * @requires admin role
 * @body {string} name - Bucket name
 */
router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { name } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Bucket name is required' });
            return;
        }

        // Validate bucket name (MinIO naming rules)
        const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
        if (!bucketNameRegex.test(name)) {
            res.status(400).json({
                error: 'Invalid bucket name. Must be 3-63 characters, lowercase, alphanumeric, hyphens, and dots only.',
            });
            return;
        }

        await minioService.createBucket(name);
        res.status(201).json({ message: 'Bucket created successfully' });
    } catch (error) {
        log.error('Failed to create raw bucket', {
            bucketName: req.body?.name || 'unknown',
            error: error instanceof Error ? error.message : String(error),
        });
        // Check for specific MinIO errors if possible, or return 500
        res.status(500).json({ error: 'Failed to create bucket. It may already exist.' });
    }
});

/**
 * DELETE /api/minio/raw/:name
 * Delete a bucket from MinIO.
 * 
 * @requires admin role
 * @param {string} name - Bucket name
 */
router.delete('/:name', requireRole('admin'), async (req: Request, res: Response) => {
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
});


/**
 * GET /api/minio/raw/keys
 * List all access keys (service accounts).
 */
router.get('/keys', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const keys = await minioService.listServiceAccounts();
        res.json({ keys });
    } catch (error: any) {
        log.error('Failed to list access keys', { message: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to list access keys' });
    }
});

/**
 * POST /api/minio/raw/keys
 * Create a new access key.
 */
router.post('/keys', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { policy, name, description } = req.body;
        const result = await minioService.createServiceAccount(policy, name, description);
        res.json(result);
    } catch (error) {
        log.error('Failed to create access key', { error });
        res.status(500).json({ error: 'Failed to create access key' });
    }
});

/**
 * DELETE /api/minio/raw/keys/:accessKey
 * Delete an access key.
 */
router.delete('/keys/:accessKey', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { accessKey } = req.params;
        if (!accessKey) {
            return res.status(400).json({ error: 'Access Key is required' });
        }
        await minioService.deleteServiceAccount(accessKey);
        return res.json({ message: 'Access key deleted successfully' });
    } catch (error) {
        log.error('Failed to delete access key', { error });
        return res.status(500).json({ error: 'Failed to delete access key' });
    }
});

export default router;
