
import { Router } from 'express';
import { MinioStorageController } from '../controllers/minio-storage.controller.js';
import { requirePermission } from '../middleware/auth.middleware.js';
import multer from 'multer';

const router = Router();
const controller = new MinioStorageController();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/:bucketName/files', requirePermission('manage_storage'), controller.listFiles.bind(controller));
router.post('/:bucketName/files', requirePermission('manage_storage'), upload.single('file'), controller.uploadFile.bind(controller));
router.get('/:bucketName/files/:fileName', requirePermission('manage_storage'), controller.downloadFile.bind(controller));
router.delete('/:bucketName/files/:fileName', requirePermission('manage_storage'), controller.deleteFile.bind(controller));

export default router;
