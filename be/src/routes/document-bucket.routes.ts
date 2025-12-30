/**
 * MinIO Bucket Routes
 * Manages application-layer bucket definitions (metadata wrappers around actual MinIO buckets).
 */
import { Router } from 'express'
import { DocumentBucketController } from '../controllers/document-bucket.controller.js';
import { requirePermission, requireAuth } from '@/middleware/auth.middleware.js'

const router = Router()
const documentBucketController = new DocumentBucketController();

/**
 * @route GET /api/document-buckets
 * @description List buckets accessible to the current user (based on permissions).
 * @access Private
 */
// Returns only the buckets the user is allowed to see
router.get('/', requireAuth, (req, res, next) => documentBucketController.getAccessibleBuckets(req, res).catch(next));

/**
 * @route GET /api/document-buckets/available/list
 * @description Expose bucket list directly from MinIO for admins/storage managers.
 * @access Private (Manage Storage)
 */
// Direct low-level list for admin usage
router.get('/available', requirePermission('manage_storage'), (req, res, next) => documentBucketController.getAvailableBuckets(req, res).catch(next));

/**
 * @route POST /api/document-buckets
 * @description Create a managed bucket (metadata stored in DB).
 * @access Private (Manage Storage)
 */
// Creates both DB record and potentially the actual MinIO bucket
router.post('/', requirePermission('manage_storage'), (req, res, next) => documentBucketController.createDocument(req, res).catch(next));

/**
 * @route DELETE /api/document-buckets/:name
 * @description Delete a managed bucket (and optionally MinIO bucket, handled in controller).
 * @access Private (Manage Storage)
 */
// Removes DB record and potentially the actual MinIO bucket
router.delete('/:bucketId', requirePermission('manage_storage'), (req, res, next) => documentBucketController.deleteDocument(req, res).catch(next));

export default router
