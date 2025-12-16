/**
 * @fileoverview RAGFlow configuration routes.
 * 
 * This module provides API endpoints for retrieving RAGFlow
 * iframe configuration. The frontend uses these URLs to embed
 * RAGFlow AI Chat and AI Search interfaces.
 * 
 * All routes require authentication and appropriate permissions.
 * 
 * @module routes/ragflow
 */

import { Router, Request, Response } from 'express';
import { log } from '../services/logger.service.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import { ragflowService } from '../services/ragflow.service.js';

const router = Router();

// ============================================================================
// Middleware
// ============================================================================

/** Apply authentication middleware to all ragflow routes */
router.use(requireAuth);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/ragflow/config
 * Returns RAGFlow iframe URLs for frontend embedding.
 * 
 * Provides direct RAGFlow URLs (no backend proxy) for:
 * - AI Chat interface
 * - AI Search interface
 * - Available chat sources
 * - Available search sources
 * 
 * @requires view_chat permission
 * @returns {Object} RAGFlow configuration with iframe URLs
 */
router.get('/config', requirePermission('view_chat'), (_req: Request, res: Response) => {
  log.debug('RAGFlow config requested');
  res.json(ragflowService.getConfig());
});

export default router;
