import { Router } from 'express'
import { ExternalTraceController } from '@/controllers/external/trace.controller.js'

const router = Router()
const controller = new ExternalTraceController()

// Accept trace payloads from external systems
router.post('/submit', controller.submitTrace.bind(controller))
// Accept user feedback tied to existing traces
router.post('/feedback', controller.submitFeedback.bind(controller))

export default router
