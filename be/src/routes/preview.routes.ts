
/**
 * Preview Routes
 * Generates lightweight previews for stored documents.
 */
import { Router } from 'express'
import { PreviewController } from '@/controllers/preview.controller.js'
import { requirePermission } from '@/middleware/auth.middleware.js'

const router = Router()
const controller = new PreviewController()

/**
 * @route GET /api/preview/:bucketName/:fileName
 * @description Serves lightweight previews for stored documents; restricted to search viewers.
 * @access Private (View Search)
 */
// Fetches and converts file content for preview handling
router.get('/:bucketName/:fileName', requirePermission('view_search'), controller.getPreview.bind(controller))

export default router
