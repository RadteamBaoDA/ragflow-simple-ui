
/**
 * Storage Raw Routes
 * Direct low-level administrative operations on storage, bypassing app-layer metadata.
 */
import { Router } from 'express'
import { StorageRawController } from '@/controllers/storage-raw.controller.js'
import { requireRole } from '@/middleware/auth.middleware.js'

const router = Router()
const controller = new StorageRawController()

/**
 * @route GET /api/storage/raw/metrics
 * @description Admin-only direct storage metrics (bypasses managed bucket abstractions).
 * @access Private (Admin only)
 */
// Fetch server stats
router.get('/metrics', requireRole('admin'), controller.getMetrics.bind(controller))

/**
 * @route GET /api/storage/raw
 * @description Lists raw storage buckets directly from the storage server.
 * @access Private (Admin only)
 */
// Direct bucket listing
router.get('/', requireRole('admin'), controller.listBuckets.bind(controller))

/**
 * @route GET /api/storage/raw/:name/stats
 * @description Bucket statistics (size/object counts).
 * @access Private (Admin only)
 */
// Get usage stats for a specific bucket
router.get('/:name/stats', requireRole('admin'), controller.getBucketStats.bind(controller))

/**
 * @route POST /api/storage/raw
 * @description Create a raw storage bucket.
 * @access Private (Admin only)
 */
// Direct bucket creation
router.post('/', requireRole('admin'), controller.createBucket.bind(controller))

/**
 * @route DELETE /api/storage/raw/:name
 * @description Delete a raw storage bucket.
 * @access Private (Admin only)
 */
// Direct bucket deletion
router.delete('/:name', requireRole('admin'), controller.deleteBucket.bind(controller))

/**
 * @route GET /api/storage/raw/keys
 * @description List access keys for storage.
 * @access Private (Admin only)
 */
// Manage storage credentials/service accounts
router.get('/keys', requireRole('admin'), controller.listKeys.bind(controller))

/**
 * @route POST /api/storage/raw/keys
 * @description Create a new access key.
 * @access Private (Admin only)
 */
// Provision new credentials
router.post('/keys', requireRole('admin'), controller.createKey.bind(controller))

/**
 * @route DELETE /api/storage/raw/keys/:accessKey
 * @description Delete an access key.
 * @access Private (Admin only)
 */
// Revoke credentials
router.delete('/keys/:accessKey', requireRole('admin'), controller.deleteKey.bind(controller))

export default router

