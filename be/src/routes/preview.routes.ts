
import { Router } from 'express';
import { PreviewController } from '../controllers/preview.controller.js';
import { requirePermission } from '../middleware/auth.middleware.js';

const router = Router();
const controller = new PreviewController();

router.get('/:bucketName/:fileName', requirePermission('view_files'), controller.getPreview.bind(controller));

export default router;
