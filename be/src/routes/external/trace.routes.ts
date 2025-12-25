
import { Router } from 'express';
import { ExternalTraceController } from '@/controllers/external-trace.controller.js';

const router = Router();
const controller = new ExternalTraceController();

router.post('/submit', controller.submitTrace.bind(controller));
router.post('/feedback', controller.submitFeedback.bind(controller));

export default router;
