import { Router, Request, Response } from 'express';
import { checkEnabled } from '../../middleware/external.middleware.js';
import traceRoutes from '@/routes/external/trace.routes.js';
import historyRoutes from '@/routes/external/history.routes.js';

const router = Router();

router.use('/trace', traceRoutes);
router.use('/history', historyRoutes);

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