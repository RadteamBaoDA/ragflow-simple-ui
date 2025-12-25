import { Router } from 'express'
import { MinioStorageController } from '@/controllers/minio-storage.controller.js'
import { requirePermission, requireAuth } from '@/middleware/auth.middleware.js'
import multer from 'multer'

const router = Router()
const controller = new MinioStorageController()
const upload = multer({ storage: multer.memoryStorage() })

// List objects within a managed bucket
router.get('/:bucketId/list', requireAuth, controller.listFiles.bind(controller))

// Upload one or many files (multipart) into a bucket
router.post('/:bucketId/upload', requireAuth, upload.array('files'), controller.uploadFile.bind(controller))

// Create a folder/prefix marker object
router.post('/:bucketId/folder', requireAuth, controller.createFolder.bind(controller))

// Delete a single object by path
router.delete('/:bucketId/delete', requireAuth, controller.deleteObject.bind(controller))

// Batch delete multiple objects in one call
router.post('/:bucketId/batch-delete', requireAuth, controller.batchDelete.bind(controller))

// Get presigned URL for secure download (wildcard captures nested paths)
router.get('/:bucketId/download/*', requireAuth, controller.getDownloadUrl.bind(controller))

// Check existence
// router.post('/:bucketId/check-existence', requirePermission('manage_storage'), controller.checkExistence.bind(controller)); 

export default router
