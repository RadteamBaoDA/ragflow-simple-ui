/**
 * @fileoverview Audit log routes.
 * 
 * This module provides API endpoints for viewing audit logs.
 * All routes require admin role - only administrators can view audit history.
 * 
 * Features:
 * - Paginated listing of audit logs
 * - Filtering by user, action, resource type, date range
 * - Search across user email and details
 * 
 * @module routes/audit
 */

import { Router, Request, Response } from 'express';
import { auditService } from '@/services/audit.service.js';
import { log } from '@/services/logger.service.js';
import { requireAuth, requireRole } from '@/middleware/auth.middleware.js';

const router = Router();

// ============================================================================
// Middleware
// ============================================================================

/** Apply authentication and admin role requirement to all audit routes */
router.use(requireAuth);
router.use(requireRole('admin'));

/**
 * Helper to safely extract string from query parameter.
 * Per OWASP Node.js Security: Query params can be strings or arrays.
 * @param value - The query parameter value
 * @returns The string value or undefined
 */
function getStringParam(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        return value[0]; // Take first value if array
    }
    return undefined;
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/audit
 * Get paginated audit logs with optional filtering.
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * - userId: Filter by user ID
 * - action: Filter by action type
 * - resourceType: Filter by resource type
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 * - search: Search in user email or details
 * 
 * @requires admin role
 * @returns {AuditLogResponse} Paginated audit logs with metadata
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        // Safely extract and validate query parameters
        const page = getStringParam(req.query.page) || '1';
        const limit = getStringParam(req.query.limit) || '50';
        const userId = getStringParam(req.query.userId);
        const action = getStringParam(req.query.action);
        const resourceType = getStringParam(req.query.resourceType);
        const startDate = getStringParam(req.query.startDate);
        const endDate = getStringParam(req.query.endDate);
        const search = getStringParam(req.query.search);

        // Parse and validate pagination params
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

        const result = await auditService.getLogs({
            page: pageNum,
            limit: limitNum,
            ...(userId && { userId }),
            ...(action && { action }),
            ...(resourceType && { resourceType }),
            ...(startDate && { startDate }),
            ...(endDate && { endDate }),
            ...(search && { search }),
        });

        log.debug('Audit logs fetched', {
            page: pageNum,
            limit: limitNum,
            total: result.pagination.total,
            requestedBy: req.session.user?.email,
        });

        res.json(result);
    } catch (error) {
        log.error('Failed to fetch audit logs', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

/**
 * GET /api/audit/actions
 * Get list of distinct action types.
 * Useful for populating filter dropdowns.
 * 
 * @requires admin role
 * @returns {string[]} List of action types
 */
router.get('/actions', async (_req: Request, res: Response) => {
    try {
        const actions = await auditService.getActionTypes();
        res.json(actions);
    } catch (error) {
        log.error('Failed to fetch action types', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to fetch action types' });
    }
});

/**
 * GET /api/audit/resource-types
 * Get list of distinct resource types.
 * Useful for populating filter dropdowns.
 * 
 * @requires admin role
 * @returns {string[]} List of resource types
 */
router.get('/resource-types', async (_req: Request, res: Response) => {
    try {
        const resourceTypes = await auditService.getResourceTypes();
        res.json(resourceTypes);
    } catch (error) {
        log.error('Failed to fetch resource types', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to fetch resource types' });
    }
});

export default router;
