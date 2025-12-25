
import { Router } from 'express';
import { MinioRawController } from '@/controllers/minio-raw.controller.js';
import { requireRole } from '@/middleware/auth.middleware.js';

const router = Router();
const controller = new MinioRawController();

router.get('/metrics', requireRole('admin'), controller.getMetrics.bind(controller));
router.get('/', requireRole('admin'), controller.listBuckets.bind(controller));
router.get('/:name/stats', requireRole('admin'), controller.getBucketStats.bind(controller));
router.post('/', requireRole('admin'), controller.createBucket.bind(controller));
router.delete('/:name', requireRole('admin'), controller.deleteBucket.bind(controller));
router.get('/keys', requireRole('admin'), controller.listKeys.bind(controller));
router.post('/keys', requireRole('admin'), controller.createKey.bind(controller));
router.delete('/keys/:accessKey', requireRole('admin'), controller.deleteKey.bind(controller));

export default router;
