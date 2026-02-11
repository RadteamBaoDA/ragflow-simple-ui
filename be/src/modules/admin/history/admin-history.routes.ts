
/**
 * Admin History Routes
 */
import { Router } from 'express';
import { AdminHistoryController } from '@/modules/admin/history/admin-history.controller.js';
import { requireAuth, requireRole } from '@/shared/middleware/auth.middleware.js';

const router = Router();
const controller = new AdminHistoryController();

/**
 * Route Definitions
 * Define endpoints for accessing chat and search history.
 * All routes are protected by authentication and role-based access control (RBAC).
 * Only users with 'admin' or 'leader' roles can access these endpoints.
 */

/**
 * @route GET /api/admin/history/chat
 * @description Retrieve paginated list of all chat sessions.
 * @access Private (Admin, Leader)
 */
// Ensure user is authenticated and has admin or leader privileges
router.get('/chat', requireAuth, requireRole('admin', 'leader'), controller.getChatHistory.bind(controller));

/**
 * @route GET /api/admin/history/chat/:sessionId
 * @description Retrieve details for a specific chat session.
 * @access Private (Admin, Leader)
 */
// Ensure user is authenticated and authorized before fetching session details
router.get('/chat/:sessionId', requireAuth, requireRole('admin', 'leader'), controller.getChatSessionDetails.bind(controller));

/**
 * @route GET /api/admin/history/search
 * @description Retrieve paginated list of all search history records.
 * @access Private (Admin, Leader)
 */
// Ensure user is authenticated and authorized before listing search history
router.get('/search', requireAuth, requireRole('admin', 'leader'), controller.getSearchHistory.bind(controller));

/**
 * @route GET /api/admin/history/search/:sessionId
 * @description Retrieve details for a specific search session.
 * @access Private (Admin, Leader)
 */
// Ensure user is authenticated and authorized before fetching search session details
router.get('/search/:sessionId', requireAuth, requireRole('admin', 'leader'), controller.getSearchSessionDetails.bind(controller));

/**
 * @route GET /api/admin/history/system-chat
 * @description Retrieve paginated list of system-level chat history (e.g., from specific admin components).
 * @access Private (Admin, Leader)
 */
// Ensure user is authenticated and authorized before listing system chat history
router.get('/system-chat', requireAuth, requireRole('admin', 'leader'), controller.getSystemChatHistory.bind(controller));

export default router;
