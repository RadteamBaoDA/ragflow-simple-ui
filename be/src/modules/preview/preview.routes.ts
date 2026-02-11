
/**
 * Preview Routes
 * Generates lightweight previews for stored documents.
 */
import { Router } from 'express'
import { PreviewController } from '@/modules/preview/preview.controller.js'
import { requirePermission } from '@/shared/middleware/auth.middleware.js'

const router = Router()
const controller = new PreviewController()

// Fetches and converts file content for preview handling
router.get('/:bucketName/*', requirePermission('view_search'), controller.getPreview.bind(controller))

export default router
