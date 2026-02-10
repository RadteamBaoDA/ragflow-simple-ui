
/**
 * Routes for RAGFlow server API endpoints.
 * Admin-only access.
 */
import { Router } from 'express'
import { RagflowServerController } from '@/controllers/ragflow-server.controller.js'
import { requireRole } from '@/middleware/auth.middleware.js'

const router = Router()

// All routes require admin role
router.get('/', requireRole('admin'), RagflowServerController.list)
router.get('/:id', requireRole('admin'), RagflowServerController.getById)
router.post('/', requireRole('admin'), RagflowServerController.create)
router.post('/test-connection', requireRole('admin'), RagflowServerController.testConnection)
router.put('/:id', requireRole('admin'), RagflowServerController.update)
router.delete('/:id', requireRole('admin'), RagflowServerController.remove)

export default router
