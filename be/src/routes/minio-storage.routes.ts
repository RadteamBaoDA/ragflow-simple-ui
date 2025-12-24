
import { Router } from 'express';
import { MinioStorageController } from '@/controllers/minio-storage.controller.js';
import { requirePermission, requireAuth } from '@/middleware/auth.middleware.js';
import multer from 'multer';

const router = Router();
const controller = new MinioStorageController();
const upload = multer({ storage: multer.memoryStorage() });

// list objects
router.get('/:bucketId/list', requireAuth, controller.listFiles.bind(controller));

// upload (supports array of files)
router.post('/:bucketId/upload', requireAuth, upload.array('files'), controller.uploadFile.bind(controller));

// create folder
router.post('/:bucketId/folder', requireAuth, controller.createFolder.bind(controller));

// delete object (single)
router.delete('/:bucketId/delete', requireAuth, controller.deleteObject.bind(controller));

// batch delete
router.post('/:bucketId/batch-delete', requireAuth, controller.batchDelete.bind(controller));

// download url (presigned) - Use wildcard for object path as it may contain slashes
router.get('/:bucketId/download/*', requireAuth, controller.getDownloadUrl.bind(controller));

// Check existence
// router.post('/:bucketId/check-existence', requirePermission('manage_storage'), controller.checkExistence.bind(controller)); 

export default router;
