import { Router, Request, Response } from 'express';
import { checkEnabled } from '../../middleware/external.middleware.js';
import traceRoutes from './trace.routes.js';
import feedbackRoutes from './feedback.routes.js';

const router = Router();

router.use('/trace', traceRoutes);
router.use('/feedback', feedbackRoutes);

/**
 * GET /api/external/health
 * 
 * Health check endpoint for external trace API.
 */
router.get('/health', checkEnabled, (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        service: 'external-trace',
        timestamp: new Date().toISOString()
    });
});

export default router;