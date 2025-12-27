
/**
 * MinIO Bucket Routes
 * Manages application-layer bucket definitions (metadata wrappers around actual MinIO buckets).
 */
import { Router } from 'express'
import { MinioBucketController } from '@/controllers/minio-bucket.controller.js'
import { requirePermission, requireAuth } from '@/middleware/auth.middleware.js'
import { CreateMinioBucketDto } from '@/models/minio-bucket.model.js'

const router = Router()
const controller = new MinioBucketController()

/**
 * @route GET /api/minio-buckets
 * @description List buckets accessible to the current user (based on permissions).
 * @access Private
 */
// Returns only the buckets the user is allowed to see
router.get('/', requireAuth, controller.getBuckets.bind(controller))

/**
 * @route GET /api/minio-buckets/available/list
 * @description Expose bucket list directly from MinIO for admins/storage managers.
 * @access Private (Manage Storage)
 */
// Direct low-level list for admin usage
router.get('/available/list', requirePermission('manage_storage'), controller.getAvailableBuckets.bind(controller))

/**
 * @route POST /api/minio-buckets
 * @description Create a managed bucket (metadata stored in DB).
 * @access Private (Manage Storage)
 */
// Creates both DB record and potentially the actual MinIO bucket
router.post('/', requirePermission('manage_storage'), controller.createBucket.bind(controller))

/**
 * @route DELETE /api/minio-buckets/:name
 * @description Delete a managed bucket (and optionally MinIO bucket, handled in controller).
 * @access Private (Manage Storage)
 */
// Removes DB record and potentially the actual MinIO bucket
router.delete('/:name', requirePermission('manage_storage'), controller.deleteBucket.bind(controller))

export default router
