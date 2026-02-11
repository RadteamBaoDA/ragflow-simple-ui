
/**
 * External Trace Routes
 * Endpoint for receiving LLM execution traces and feedback.
 */
import { Router } from 'express'
import { ExternalTraceController } from '@/modules/external/trace.controller.js'

const router = Router()
const controller = new ExternalTraceController()

/**
 * @route POST /api/external/trace/submit
 * @description Accept trace payloads from external systems.
 * @access Public (Protected by downstream validation)
 */
// Ingestion endpoint for trace data
router.post('/submit', controller.submitTrace.bind(controller))

/**
 * @route POST /api/external/trace/feedback
 * @description Accept user feedback tied to existing traces.
 * @access Public (Protected by downstream validation)
 */
// Ingestion endpoint for trace feedback scores
router.post('/feedback', controller.submitFeedback.bind(controller))

export default router
