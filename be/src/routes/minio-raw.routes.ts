
import { Router } from 'express';
import { MinioRawController } from '../controllers/minio-raw.controller.js';
import { requireRole } from '../middleware/auth.middleware.js';

const router = Router();
const controller = new MinioRawController();

router.get('/metrics', requireRole('admin'), (req, res) => { controller.getMetrics(req, res); });
router.get('/', requireRole('admin'), (req, res) => { controller.listBuckets(req, res); });
router.get('/:name/stats', requireRole('admin'), (req, res) => { controller.getBucketStats(req, res); });
router.post('/', requireRole('admin'), (req, res) => { controller.createBucket(req, res); });
router.delete('/:name', requireRole('admin'), (req, res) => { controller.deleteBucket(req, res); });
router.get('/keys', requireRole('admin'), (req, res) => { controller.listKeys(req, res); });
router.post('/keys', requireRole('admin'), (req, res) => { controller.createKey(req, res); });
router.delete('/keys/:accessKey', requireRole('admin'), (req, res) => { controller.deleteKey(req, res); });

export default router;
