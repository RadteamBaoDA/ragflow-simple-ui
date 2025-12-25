import { Router } from 'express'
import { checkEnabled } from '../../middleware/external.middleware.js'
import traceRoutes from '@/routes/external/trace.routes.js'
import historyRoutes from '@/routes/external/history.routes.js'
import { ExternalTraceController } from '@/controllers/external/trace.controller.js'

const router = Router()
const controller = new ExternalTraceController()

// External tracing endpoints (submit/feedback) are mounted under /trace
router.use('/trace', traceRoutes)

// External history endpoints (chat/search) are mounted under /history
router.use('/history', historyRoutes)

/**
 * GET /api/external/health
 * 
 * Health check endpoint for external trace API.
 */
router.get('/health', checkEnabled, controller.getHealth.bind(controller))

export default router