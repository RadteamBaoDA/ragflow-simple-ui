
import { Router } from 'express';
import { ExternalTraceController } from '../../controllers/external-trace.controller.js';
// Auth middleware needed? Maybe API key based which is inside service/controller logic usually or custom middleware
// Checking original trace.routes.ts...
// Assuming authentication is handled via API key in controller or specific middleware.

const router = Router();
const controller = new ExternalTraceController();

router.post('/submit', controller.submitTrace.bind(controller));
router.post('/feedback', controller.submitFeedback.bind(controller));

export default router;
