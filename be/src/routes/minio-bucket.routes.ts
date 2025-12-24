
import { Router } from 'express';
import { MinioBucketController } from '../controllers/minio-bucket.controller.js';
import { requirePermission } from '../middleware/auth.middleware.js';
import { CreateMinioBucketDto } from '../models/minio-bucket.model.js'; // Ensure imported if validation logic uses it

const router = Router();
const controller = new MinioBucketController();

router.get('/', requirePermission('manage_storage'), controller.getBuckets.bind(controller));
router.post('/', requirePermission('manage_storage'), controller.createBucket.bind(controller));
router.delete('/:name', requirePermission('manage_storage'), controller.deleteBucket.bind(controller));

export default router;
