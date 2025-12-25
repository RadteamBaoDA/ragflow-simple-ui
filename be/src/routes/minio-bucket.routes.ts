import { Router } from 'express'
import { MinioBucketController } from '@/controllers/minio-bucket.controller.js'
import { requirePermission, requireAuth } from '@/middleware/auth.middleware.js'
import { CreateMinioBucketDto } from '@/models/minio-bucket.model.js'

const router = Router()
const controller = new MinioBucketController()

// List buckets accessible to the current user
router.get('/', requireAuth, controller.getBuckets.bind(controller))
// Expose bucket list directly from MinIO for admins/storage managers
router.get('/available/list', requirePermission('manage_storage'), controller.getAvailableBuckets.bind(controller))
// Create a managed bucket (metadata stored in DB)
router.post('/', requirePermission('manage_storage'), controller.createBucket.bind(controller))
// Delete a managed bucket (and optionally MinIO bucket, handled in controller)
router.delete('/:name', requirePermission('manage_storage'), controller.deleteBucket.bind(controller))

export default router
