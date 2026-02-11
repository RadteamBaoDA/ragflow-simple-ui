
/**
 * Centralized route registration for all API endpoints.
 * Consolidates route imports, middleware, and mounts them on the Express app.
 * @module routes/index
 */
import { Router, Express, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { checkConnection } from '@/shared/db/index.js';
import { getRedisStatus } from '@/shared/services/redis.service.js';
import { log } from '@/shared/services/logger.service.js';

// Route imports
import authRoutes from '@/modules/auth/auth.routes.js';
import knowledgeBaseRoutes from '@/modules/knowledge-base/knowledge-base.routes.js';
import adminRoutes from '@/modules/admin/admin.routes.js';
import userRoutes from '@/modules/users/users.routes.js';
import teamRoutes from '@/modules/teams/teams.routes.js';
import systemToolsRoutes from '@/modules/system-tools/system-tools.routes.js';
import auditRoutes from '@/modules/audit/audit.routes.js';
import externalRoutes from '@/modules/external/routes/index.js';
import broadcastMessageRoutes from '@/modules/broadcast/broadcast-message.routes.js';
import adminHistoryRoutes from '@/modules/admin/admin-history.routes.js';
import chatHistoryRoutes from '@/modules/chat/chat-history.routes.js';
import userHistoryRoutes from '@/modules/user-history/user-history.routes.js';

import dashboardRoutes from '@/modules/dashboard/dashboard.routes.js';
import glossaryRoutes from '@/modules/glossary/glossary.routes.js';

// ============================================================================
// Rate Limiters
// ============================================================================

/**
 * General API rate limiter to prevent abuse.
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

/**
 * Stricter rate limit for authentication endpoints.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.' },
});

// ============================================================================
// Middleware
// ============================================================================

/**
 * Validate Content-Type header for mutation requests.
 * @description Ensures POST/PUT/PATCH requests use allowed content types.
 */
const validateContentType = (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'];
        if (!contentType) return next();

        if (contentType.includes('application/json') ||
            contentType.includes('multipart/form-data') ||
            contentType.includes('application/x-www-form-urlencoded')) {
            return next();
        }

        return res.status(415).json({
            error: 'Unsupported Media Type',
            message: 'Content-Type must be application/json, multipart/form-data, or application/x-www-form-urlencoded'
        });
    }
    next();
};

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register all API routes on the provided Express router.
 * @param apiRouter - Express Router instance to mount routes on.
 * @description Mounts all feature routes with their respective base paths.
 */
function registerRoutes(apiRouter: Router): void {
    // Apply auth rate limiting to login endpoints
    apiRouter.use('/auth/login', authLimiter);
    apiRouter.use('/auth/callback', authLimiter);

    // Authentication routes
    apiRouter.use('/auth', authRoutes);

    // Knowledge base management
    apiRouter.use('/knowledge-base', knowledgeBaseRoutes);

    // Admin routes
    apiRouter.use('/admin', adminRoutes);
    apiRouter.use('/admin/history', adminHistoryRoutes);
    apiRouter.use('/admin/dashboard', dashboardRoutes);

    // User management
    apiRouter.use('/users', userRoutes);
    apiRouter.use('/user/history', userHistoryRoutes);

    // Team management
    apiRouter.use('/teams', teamRoutes);

    // System tools (health checks, diagnostics)
    apiRouter.use('/system-tools', systemToolsRoutes);

    // Audit logging
    apiRouter.use('/audit', auditRoutes);

    // External integrations
    apiRouter.use('/external', externalRoutes);

    // Broadcast messages
    apiRouter.use('/broadcast-messages', broadcastMessageRoutes);

    // Chat history
    apiRouter.use('/chat', chatHistoryRoutes);



    // Glossary management (tasks, keywords, prompt builder)
    apiRouter.use('/glossary', glossaryRoutes);
}

// ============================================================================
// Main Setup Function
// ============================================================================

/**
 * Setup all API routes and middleware on the Express app.
 * @param app - Express application instance.
 * @description Configures rate limiting, content validation, health check, 
 *              API routes, 404 handler, and error handler.
 */
export function setupApiRoutes(app: Express): void {
    // Apply general rate limiter to all API routes
    app.use('/api', generalLimiter);

    // Health check endpoint (outside /api for load balancer probes)
    app.get('/health', async (_req: Request, res: Response) => {
        const timestamp = new Date().toISOString();
        const dbConnected = await checkConnection();
        const redisStatus = getRedisStatus();

        const healthPayload = {
            status: dbConnected && (redisStatus === 'connected' || redisStatus === 'not_configured') ? 'ok' : 'degraded',
            timestamp,
            services: {
                express: 'running',
                database: dbConnected ? 'connected' : 'disconnected',
                redis: redisStatus,
            },
        };

        res.status(healthPayload.status === 'ok' ? 200 : 503).json(healthPayload);
    });

    // Content-Type validation middleware
    app.use('/api', validateContentType);

    // Register all API routes
    const apiRouter = Router();
    registerRoutes(apiRouter);
    app.use('/api', apiRouter);

    // 404 handler for unknown API routes
    app.use('/api/*', (_req: Request, res: Response) => {
        res.status(404).json({ error: 'Not Found', message: 'The requested API endpoint does not exist' });
    });

    // Global error handler
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        log.error('Unhandled error', { error: err.message, stack: err.stack });
        res.status(500).json({ error: 'Internal server error' });
    });
}

export { registerRoutes };
export default setupApiRoutes;
