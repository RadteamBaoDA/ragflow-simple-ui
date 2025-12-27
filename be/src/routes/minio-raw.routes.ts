
/**
 * MinIO Raw Routes
 * Direct low-level administrative operations on MinIO, bypassing app-layer metadata.
 */
import { Router } from 'express'
import { MinioRawController } from '@/controllers/minio-raw.controller.js'
import { requireRole } from '@/middleware/auth.middleware.js'

const router = Router()
const controller = new MinioRawController()

/**
 * @route GET /api/minio-raw/metrics
 * @description Admin-only direct MinIO metrics (bypasses managed bucket abstractions).
 * @access Private (Admin only)
 */
// Fetch server stats
router.get('/metrics', requireRole('admin'), controller.getMetrics.bind(controller))

/**
 * @route GET /api/minio-raw
 * @description Lists raw MinIO buckets directly from the storage server.
 * @access Private (Admin only)
 */
// Direct S3/MinIO bucket listing
router.get('/', requireRole('admin'), controller.listBuckets.bind(controller))

/**
 * @route GET /api/minio-raw/:name/stats
 * @description Bucket statistics (size/object counts).
 * @access Private (Admin only)
 */
// Get usage stats for a specific bucket
router.get('/:name/stats', requireRole('admin'), controller.getBucketStats.bind(controller))

/**
 * @route POST /api/minio-raw
 * @description Create a raw MinIO bucket.
 * @access Private (Admin only)
 */
// Direct bucket creation
router.post('/', requireRole('admin'), controller.createBucket.bind(controller))

/**
 * @route DELETE /api/minio-raw/:name
 * @description Delete a raw MinIO bucket.
 * @access Private (Admin only)
 */
// Direct bucket deletion
router.delete('/:name', requireRole('admin'), controller.deleteBucket.bind(controller))

/**
 * @route GET /api/minio-raw/keys
 * @description List access keys for MinIO.
 * @access Private (Admin only)
 */
// Manage MinIO credentials/service accounts
router.get('/keys', requireRole('admin'), controller.listKeys.bind(controller))

/**
 * @route POST /api/minio-raw/keys
 * @description Create a new access key.
 * @access Private (Admin only)
 */
// Provision new credentials
router.post('/keys', requireRole('admin'), controller.createKey.bind(controller))

/**
 * @route DELETE /api/minio-raw/keys/:accessKey
 * @description Delete an access key.
 * @access Private (Admin only)
 */
// Revoke credentials
router.delete('/keys/:accessKey', requireRole('admin'), controller.deleteKey.bind(controller))

export default router
