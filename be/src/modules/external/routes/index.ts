
/**
 * External API Routes Index
 * Aggregates all external-facing endpoints like tracing and history.
 */
import { Router } from 'express'
import { checkEnabled } from '@/modules/external/middleware/external.middleware.js'
import traceRoutes from '@/modules/external/routes/trace.routes.js'
import historyRoutes from '@/modules/external/routes/history.routes.js'
import { ExternalTraceController } from '@/modules/external/trace.controller.js'

const router = Router()
const controller = new ExternalTraceController()

/**
 * Mounts trace routes under /trace.
 * Used for logging LangChain/LLM traces from external apps.
 */
router.use('/trace', traceRoutes)

/**
 * Mounts history routes under /history.
 * Used for syncing chat/search history from external apps.
 */
router.use('/history', historyRoutes)

/**
 * @route GET /api/external/health
 * @description Health check endpoint for external trace API.
 * @access Public (Protected by checkEnabled middleware)
 */
// Simple liveness check for external integrations
router.get('/health', checkEnabled, controller.getHealth.bind(controller))

export default router