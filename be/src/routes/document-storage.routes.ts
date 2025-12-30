
/**
 * MinIO Storage Routes
 * Handles object-level operations: uploading files, listing content, creating folders, and deleting objects.
 */
import { Router } from 'express'
import { DocumentStorageController } from '../controllers/document-storage.controller.js';
import { requirePermission, requireAuth } from '@/middleware/auth.middleware.js'
import multer from 'multer'

const router = Router()
const documentStorageController = new DocumentStorageController();
// Use memory storage for Multer to keep files in RAM before streaming to MinIO
const upload = multer({ storage: multer.memoryStorage() })

/**
 * @route GET /api/storage/:bucketId/list
 * @description List objects within a managed bucket.
 * @access Private
 */
// Lists files in the virtual folder structure
router.get('/:bucketId/list', requireAuth, (req, res, next) => documentStorageController.listFiles(req, res).catch(next));

/**
 * @route POST /api/storage/:bucketId/upload
 * @description Upload one or many files (multipart) into a bucket.
 * @access Private
 */
// Handles multipart file uploads
router.post('/:bucketId/upload', requireAuth, upload.array('files'), (req, res, next) => documentStorageController.uploadFile(req, res).catch(next));

/**
 * @route POST /api/storage/:bucketId/folder
 * @description Create a folder/prefix marker object.
 * @access Private
 */
// Creates a zero-byte object ending in '/' to simulate a directory
router.post('/:bucketId/folder', requireAuth, (req, res, next) => documentStorageController.createFolder(req, res).catch(next));

/**
 * @route DELETE /api/storage/:bucketId/delete
 * @description Delete a single object by path.
 * @access Private
 */
// Deletes a specific file or folder
router.delete('/:bucketId/delete', requireAuth, (req, res, next) => documentStorageController.deleteObject(req, res).catch(next));

/**
 * @route POST /api/storage/:bucketId/batch-delete
 * @description Batch delete multiple objects in one call.
 * @access Private
 */
// Efficiently removes multiple items
router.post('/:bucketId/batch-delete', requireAuth, (req, res, next) => documentStorageController.batchDelete(req, res).catch(next));

/**
 * @route GET /api/storage/:bucketId/download/*
 * @description Get presigned URL for secure download (wildcard captures nested paths).
 * @access Private
 */
// Generates temporary access URL for downloading files
router.get('/:bucketId/download', requireAuth, (req, res, next) => documentStorageController.getDownloadUrl(req, res).catch(next));

// Check existence (commented out in source)
// router.post('/:bucketId/check-existence', requirePermission('manage_storage'), controller.checkExistence.bind(controller)); 

export default router
