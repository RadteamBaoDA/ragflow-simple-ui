/**
 * @fileoverview User History Routes.
 * Defines API endpoints for user-specific chat and search history.
 * All routes require authentication.
 * 
 * @module routes/user-history.routes
 */

import { Router } from 'express';
import { UserHistoryController } from '@/modules/user-history/user-history.controller.js';
import { requireAuth } from '@/shared/middleware/auth.middleware.js';

const router = Router();
const controller = new UserHistoryController();

/**
 * @route GET /api/user/history/chat
 * @description Retrieve paginated list of user's chat sessions.
 * @access Private (Authenticated users)
 * @query {string} q - Search query
 * @query {string} startDate - Filter by start date
 * @query {string} endDate - Filter by end date
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 */
router.get('/chat', requireAuth, controller.getChatHistory.bind(controller));

/**
 * @route GET /api/user/history/chat/:sessionId
 * @description Retrieve details for a specific chat session.
 * @access Private (Authenticated users, own sessions only)
 * @param {string} sessionId - The session ID
 */
router.get('/chat/:sessionId', requireAuth, controller.getChatSessionDetails.bind(controller));

/**
 * @route GET /api/user/history/search
 * @description Retrieve paginated list of user's search sessions.
 * @access Private (Authenticated users)
 * @query {string} q - Search query
 * @query {string} startDate - Filter by start date
 * @query {string} endDate - Filter by end date
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 */
router.get('/search', requireAuth, controller.getSearchHistory.bind(controller));

/**
 * @route GET /api/user/history/search/:sessionId
 * @description Retrieve details for a specific search session.
 * @access Private (Authenticated users, own sessions only)
 * @param {string} sessionId - The session ID
 */
router.get('/search/:sessionId', requireAuth, controller.getSearchSessionDetails.bind(controller));

export default router;
