import { Router } from 'express'
import { checkEnabled } from '../../middleware/external.middleware.js'
import traceRoutes from '@/routes/external/trace.routes.js'
import { ExternalTraceController } from '@/controllers/external/trace.controller.js'

const router = Router()
const controller = new ExternalTraceController()

// External tracing endpoints (submit/feedback) are mounted under /trace
router.use('/trace', traceRoutes)

/**
 * GET /api/external/health
 * 
 * Health check endpoint for external trace API.
 */
router.get('/health', checkEnabled, controller.getHealth.bind(controller))

export default router