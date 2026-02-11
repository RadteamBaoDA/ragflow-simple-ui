
/**
 * Routes for document category and version API endpoints.
 * Nested under /api/projects/:projectId/categories.
 */
import { Router } from 'express'
import { DocumentCategoryController } from '@/modules/projects/document-category/document-category.controller.js'
import { requireAuth } from '@/shared/middleware/auth.middleware.js'
import multer from 'multer'

// Configure multer for file upload (memory storage for buffer access)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })

const router = Router({ mergeParams: true })

// Category CRUD
router.get('/', requireAuth, DocumentCategoryController.listCategories)
router.post('/', requireAuth, DocumentCategoryController.createCategory)
router.put('/:categoryId', requireAuth, DocumentCategoryController.updateCategory)
router.delete('/:categoryId', requireAuth, DocumentCategoryController.deleteCategory)

// Version CRUD (nested under category)
router.get('/:categoryId/versions', requireAuth, DocumentCategoryController.listVersions)
router.post('/:categoryId/versions', requireAuth, DocumentCategoryController.createVersion)
router.post('/:categoryId/versions/:versionId/sync', requireAuth, DocumentCategoryController.syncVersion)
router.put('/:categoryId/versions/:versionId', requireAuth, DocumentCategoryController.updateVersion)
router.put('/:categoryId/versions/:versionId/archive', requireAuth, DocumentCategoryController.archiveVersion)
router.delete('/:categoryId/versions/:versionId', requireAuth, DocumentCategoryController.deleteVersion)

// Document operations (nested under version)
router.get('/:categoryId/versions/:versionId/documents', requireAuth, DocumentCategoryController.listDocuments)
router.post(
  '/:categoryId/versions/:versionId/documents',
  requireAuth,
  upload.single('file'),
  DocumentCategoryController.uploadDocument
)

export default router
