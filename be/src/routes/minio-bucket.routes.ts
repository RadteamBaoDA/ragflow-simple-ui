/**
 * @fileoverview MinIO bucket management routes for Knowledge Base Documents.
 * 
 * This module provides API endpoints for managing MinIO bucket metadata.
 * Bucket configurations are stored in database - actual MinIO buckets are not
 * created or deleted. This allows admins to configure which existing MinIO
 * buckets are accessible through the application.
 * 
 * All routes require admin role.
 * 
 * Features:
 * - Add bucket configuration to database (link existing MinIO bucket)
 * - List configured buckets from database
 * - Verify bucket existence in MinIO
 * - Remove bucket configuration from database
 * 
 * @module routes/minio-bucket
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { minioService } from '../services/minio.service.js';
import { db } from '../db/index.js';
import { log } from '../services/logger.service.js';
import { requireRole } from '../middleware/auth.middleware.js';
import { MinioBucket, CreateMinioBucketDto } from '../models/minio-bucket.model.js';
import { auditService, AuditAction, AuditResourceType } from '../services/audit.service.js';

const router = Router();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract client IP from request headers.
 */
function getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];

    if (typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0]?.trim() || 'unknown';
    }
    if (typeof realIp === 'string') {
        return realIp;
    }
    return req.socket.remoteAddress || 'unknown';
}

// ============================================================================
// Middleware
// ============================================================================

// Note: Middleware is applied per-route to allow different access levels:
// - Admin + Manager: List buckets (GET /)
// - Admin only: Create, delete, verify buckets

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/minio/buckets
 * List all configured buckets from database.
 * 
 * Returns active bucket configurations with display names.
 * Accessible by both admin and manager roles.
 * 
 * @requires admin or manager role
 * @returns {Object} Buckets array and count
 * @returns {500} If database query fails
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const user = req.session.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        log.debug('Fetching configured MinIO buckets', { user: user.email });

        let buckets: MinioBucket[];
        if (user.role === 'admin') {
            // Admins see all active buckets
            buckets = await db.query<MinioBucket>(
                'SELECT * FROM minio_buckets WHERE is_active = 1 ORDER BY created_at DESC'
            );
        } else {
            // Others only see buckets where they have direct permission OR team-based permission
            // Using a subquery or join to find buckets with permissions > 0
            buckets = await db.query<MinioBucket>(`
                SELECT b.* 
                FROM minio_buckets b
                WHERE b.is_active = 1 AND (
                    EXISTS (
                        SELECT 1 FROM document_permissions sp 
                        WHERE sp.bucket_id::text = b.id::text 
                        AND sp.entity_type = 'user' 
                        AND sp.entity_id::text = $1::text 
                        AND sp.permission_level > 0
                    )
                    OR EXISTS (
                        SELECT 1 FROM document_permissions sp
                        JOIN user_teams ut ON sp.entity_id::text = ut.team_id::text
                        WHERE sp.bucket_id::text = b.id::text
                        AND sp.entity_type = 'team'
                        AND ut.user_id::text = $1::text
                        AND sp.permission_level > 0
                        AND ut.role = 'leader'
                    )
                )
                ORDER BY b.created_at DESC
            `, [user.id]);
        }

        return res.json({
            buckets,
            count: buckets.length,
        });
    } catch (error) {
        log.error('Failed to fetch MinIO buckets', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({ error: 'Failed to fetch buckets' });
    }
});

/**
 * POST /api/minio/buckets
 * Add a bucket configuration to database.
 * 
 * This does NOT create the bucket in MinIO - it only adds metadata
 * to link an existing MinIO bucket to the application.
 * 
 * Bucket configuration process:
 * 1. Validate bucket name (S3 naming rules)
 * 2. Check if bucket exists in MinIO (must exist)
 * 3. Check if bucket is already configured in database
 * 4. Save bucket configuration to database
 * 
 * @requires admin role
 * @body {string} bucket_name - MinIO bucket name (must exist in MinIO)
 * @body {string} display_name - Human-readable display name
 * @body {string} [description] - Optional description
 * @returns {Object} Created bucket configuration
 * @returns {400} If validation fails or bucket doesn't exist in MinIO
 * @returns {409} If bucket is already configured
 * @returns {500} If database operation fails
 */
router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { bucket_name, display_name, description } = req.body as CreateMinioBucketDto;
        const userId = req.session.user?.id;

        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        // Validate input
        if (!bucket_name || !display_name) {
            res.status(400).json({ error: 'bucket_name and display_name are required' });
            return;
        }

        // Validate bucket name (MinIO naming rules: lowercase, alphanumeric, hyphens, dots)
        const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
        if (!bucketNameRegex.test(bucket_name)) {
            res.status(400).json({
                error: 'Invalid bucket name. Must be 3-63 characters, lowercase, alphanumeric, hyphens, and dots only.',
            });
            return;
        }

        // Check if bucket exists in MinIO (it must exist)
        const existsInMinio = await minioService.bucketExists(bucket_name);
        if (!existsInMinio) {
            res.status(400).json({ error: 'Bucket does not exist in MinIO. Please create it in MinIO first.' });
            return;
        }

        // Check if bucket is already configured in database (including soft-deleted)
        const existing = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE bucket_name = $1',
            [bucket_name]
        );

        if (existing.length > 0) {
            const existingBucket = existing[0]!;

            // If bucket was soft-deleted, reactivate it with updated info
            // Note: is_active is stored as INTEGER (0/1) in DB but may be returned as boolean
            if (!existingBucket.is_active || existingBucket.is_active === 0) {
                await db.query(
                    'UPDATE minio_buckets SET display_name = $1, description = $2, is_active = 1 WHERE id = $3',
                    [display_name, description || null, existingBucket.id]
                );

                const reactivatedBucket = await db.query<MinioBucket>(
                    'SELECT * FROM minio_buckets WHERE id = $1',
                    [existingBucket.id]
                );

                log.debug('MinIO bucket configuration reactivated', {
                    bucketId: existingBucket.id,
                    bucketName: bucket_name,
                    user: req.session.user?.email,
                });

                // Log audit event for bucket reactivation
                await auditService.log({
                    userId: req.session.user?.id ?? null,
                    userEmail: req.session.user?.email || 'unknown',
                    action: AuditAction.CREATE_BUCKET,
                    resourceType: AuditResourceType.BUCKET,
                    resourceId: existingBucket.id,
                    details: {
                        bucketName: bucket_name,
                        displayName: display_name,
                        reactivated: true,
                    },
                    ipAddress: getClientIp(req),
                });

                res.status(201).json({
                    message: 'Bucket configuration reactivated successfully',
                    bucket: reactivatedBucket[0],
                });
                return;
            }

            // Bucket is already active
            res.status(409).json({ error: 'Bucket is already configured' });
            return;
        }

        // Save bucket configuration to database
        const bucketId = uuidv4();
        await db.query(
            'INSERT INTO minio_buckets (id, bucket_name, display_name, description, created_by, is_active) VALUES ($1, $2, $3, $4, $5, 1)',
            [bucketId, bucket_name, display_name, description || null, userId]
        );

        const newBucket = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE id = $1',
            [bucketId]
        );

        log.debug('MinIO bucket configured', {
            bucketId,
            bucketName: bucket_name,
            user: req.session.user?.email,
        });

        // Log audit event for bucket configuration
        await auditService.log({
            userId: req.session.user?.id ?? null,
            userEmail: req.session.user?.email || 'unknown',
            action: AuditAction.CREATE_BUCKET,
            resourceType: AuditResourceType.BUCKET,
            resourceId: bucketId,
            details: {
                bucketName: bucket_name,
                displayName: display_name,
            },
            ipAddress: getClientIp(req),
        });

        res.status(201).json({
            message: 'Bucket configured successfully',
            bucket: newBucket[0],
        });
    } catch (error) {
        log.error('Failed to configure MinIO bucket', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to configure bucket' });
    }
});

/**
 * DELETE /api/minio/buckets/:id
 * Remove a bucket configuration from database.
 * 
 * This does NOT delete the bucket from MinIO - it only removes
 * the metadata configuration from the database.
 * 
 * @requires admin role
 * @param {string} id - Bucket ID (UUID)
 * @returns {Object} Success message
 * @returns {404} If bucket not found
 * @returns {500} If database operation fails
 */
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get bucket details from database (only active buckets)
        const buckets = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE id = $1 AND is_active = 1',
            [id]
        );

        if (buckets.length === 0) {
            res.status(404).json({ error: 'Bucket configuration not found' });
            return;
        }

        const bucket = buckets[0]!;

        // Soft delete: Set is_active to 0 instead of deleting the row
        await db.query('UPDATE minio_buckets SET is_active = 0 WHERE id = $1', [id]);

        log.debug('MinIO bucket configuration removed', {
            bucketId: id,
            bucketName: bucket.bucket_name,
            user: req.session.user?.email,
        });

        // Log audit event for bucket removal
        await auditService.log({
            userId: req.session.user?.id ?? null,
            userEmail: req.session.user?.email || 'unknown',
            action: AuditAction.DELETE_BUCKET,
            resourceType: AuditResourceType.BUCKET,
            resourceId: id,
            details: {
                bucketName: bucket.bucket_name,
                displayName: bucket.display_name,
            },
            ipAddress: getClientIp(req),
        });

        res.json({
            message: 'Bucket configuration removed successfully',
        });
    } catch (error) {
        log.error('Failed to remove MinIO bucket configuration', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to remove bucket configuration' });
    }
});

/**
 * GET /api/minio/buckets/:id/verify
 * Verify if bucket exists in MinIO.
 * 
 * Checks if the configured bucket actually exists in MinIO.
 * Useful for debugging sync issues between database and MinIO.
 * 
 * @requires admin role
 * @param {string} id - Bucket ID (UUID)
 * @returns {Object} Bucket name and existence status
 * @returns {404} If bucket not found in database
 * @returns {500} If MinIO check fails
 */
router.get('/:id/verify', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const buckets = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE id = $1',
            [id]
        );

        if (buckets.length === 0) {
            res.status(404).json({ error: 'Bucket configuration not found' });
            return;
        }

        const bucket = buckets[0]!;
        const exists = await minioService.bucketExists(bucket.bucket_name);

        res.json({
            bucket_name: bucket.bucket_name,
            exists,
        });
    } catch (error) {
        log.error('Failed to verify bucket', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to verify bucket' });
    }
});

/**
 * GET /api/minio/buckets/available
 * List all buckets from MinIO that are not yet configured.
 * 
 * Returns buckets that exist in MinIO but are not in the database.
 * Helps admins discover which buckets can be added.
 * 
 * @requires admin role
 * @returns {Object} Available buckets array
 * @returns {500} If MinIO query fails
 */
router.get('/available/list', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        // Get all buckets from MinIO
        const minioBuckets = await minioService.listBuckets();

        // Get all configured bucket names from database
        const configuredBuckets = await db.query<MinioBucket>(
            'SELECT bucket_name FROM minio_buckets WHERE is_active = 1'
        );
        const configuredNames = new Set(configuredBuckets.map(b => b.bucket_name));

        // Filter to only unconfigured buckets
        const availableBuckets = minioBuckets
            .filter(b => !configuredNames.has(b.name))
            .map(b => ({
                name: b.name,
                creationDate: b.creationDate,
            }));

        res.json({
            buckets: availableBuckets,
            count: availableBuckets.length,
        });
    } catch (error) {
        log.error('Failed to list available buckets', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to list available buckets' });
    }
});

export default router;
