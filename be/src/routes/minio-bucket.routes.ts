
import { Router } from 'express';
import { MinioBucketController } from '@/controllers/minio-bucket.controller.js';
import { requirePermission, requireAuth } from '@/middleware/auth.middleware.js';
import { CreateMinioBucketDto } from '@/models/minio-bucket.model.js';

const router = Router();
const controller = new MinioBucketController();

router.get('/', requireAuth, controller.getBuckets.bind(controller));
router.get('/available/list', requirePermission('manage_storage'), controller.getAvailableBuckets.bind(controller));
router.post('/', requirePermission('manage_storage'), controller.createBucket.bind(controller));
router.delete('/:name', requirePermission('manage_storage'), controller.deleteBucket.bind(controller));

export default router;
