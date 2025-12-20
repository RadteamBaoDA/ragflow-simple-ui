/**
 * @fileoverview System monitoring tools routes.
 * 
 * This module provides API endpoints for accessing system monitoring tools
 * configured in system-tools.config.json. These are external services like
 * Portainer, Grafana, Langfuse, etc. that admins can access.
 * 
 * All routes require admin role.
 * 
 * @module routes/system-tools
 */

import { Router, Request, Response } from 'express';
import { systemToolsService } from '../services/system-tools.service.js';
import { log } from '../services/logger.service.js';
import { requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// ============================================================================
// Middleware
// ============================================================================

/** Require admin role for all system tools routes */
router.use(requireRole('admin'));

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/system-tools
 * Get all enabled system monitoring tools.
 * 
 * Returns tools configured in system-tools.config.json that have
 * enabled: true. Each tool includes name, icon, URL, and description.
 * 
 * @requires admin role
 * @returns {Object} Tools array and count
 * @returns {500} If configuration loading fails
 */
router.get('/', (req: Request, res: Response) => {
    try {
        log.debug('Fetching system tools', { user: req.session.user?.email });

        const tools = systemToolsService.getEnabledTools();

        res.json({
            tools,
            count: tools.length,
        });
    } catch (error) {
        log.error('Failed to fetch system tools', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to fetch system tools' });
    }
});

/**
 * POST /api/system-tools/reload
 * Reload system tools configuration from disk.
 * 
 * Hot-reloads the system-tools.config.json file without
 * restarting the server. Useful for adding/modifying tools.
 * 
 * @requires admin role
 * @returns {Object} Success message and new tool count
 * @returns {500} If reload fails
 */
router.post('/reload', (req: Request, res: Response) => {
    try {
        log.debug('Reloading system tools configuration', {
            user: req.session.user?.email,
        });

        systemToolsService.reload();
        const tools = systemToolsService.getEnabledTools();

        res.json({
            message: 'System tools configuration reloaded',
            count: tools.length,
        });
    } catch (error) {
        log.error('Failed to reload system tools', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to reload system tools' });
    }
});

/**
 * GET /api/system-tools/health
 * Get system health metrics (DB, Redis, MinIO, System).
 * 
 * @requires admin role
 * @returns {Object} System health metrics
 */
router.get('/health', async (req: Request, res: Response) => {
    try {
        const health = await systemToolsService.getSystemHealth();
        res.json(health);
    } catch (error) {
        log.error('Failed to get system health', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to get system health' });
    }
});

export default router;
