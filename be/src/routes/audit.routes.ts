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

import { Router } from 'express';
import { AuditController } from '@/controllers/audit.controller.js';
import { requireAuth, requireRole } from '@/middleware/auth.middleware.js';

const router = Router();
const controller = new AuditController();

// ============================================================================
// Middleware
// ============================================================================

/** Apply authentication and admin role requirement to all audit routes */
router.use(requireAuth);
router.use(requireRole('admin'));

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
router.get('/', controller.getLogs.bind(controller));

/**
 * GET /api/audit/actions
 * Get list of distinct action types.
 * Useful for populating filter dropdowns.
 * 
 * @requires admin role
 * @returns {string[]} List of action types
 */
router.get('/actions', controller.getActions.bind(controller));

/**
 * GET /api/audit/resource-types
 * Get list of distinct resource types.
 * Useful for populating filter dropdowns.
 * 
 * @requires admin role
 * @returns {string[]} List of resource types
 */
router.get('/resource-types', controller.getResourceTypes.bind(controller));

export default router;
