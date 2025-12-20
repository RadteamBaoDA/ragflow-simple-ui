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
import { requireAuth, requirePermission, requireRole } from '../middleware/auth.middleware.js';
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
router.get('/config', requirePermission('view_chat'), async (_req: Request, res: Response) => {
  log.debug('RAGFlow config requested');
  const config = await ragflowService.getConfig();
  res.json(config);
});

/**
 * GET /api/ragflow/sources
 * Returns paginated sources.
 */
router.get('/sources', requirePermission('view_chat'), async (req: Request, res: Response) => {
  try {
    const user = req.user;
    // Only admins and leaders can see the full list of sources
    if (user?.role === 'user') {
      res.json({
        data: [],
        total: 0,
        page: 1,
        limit: 10
      });
      return;
    }

    const type = req.query.type as 'chat' | 'search';
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);

    if (!['chat', 'search'].includes(type)) {
      res.status(400).json({ error: 'Invalid type. Must be chat or search' });
      return; // Explicit return to stop execution
    }

    const result = await ragflowService.getSourcesPaginated(type, page, limit);
    res.json(result);
  } catch (error) {
    log.error('Error fetching sources', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/config', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { defaultChatSourceId, defaultSearchSourceId } = req.body;
    if (defaultChatSourceId !== undefined) await ragflowService.saveSystemConfig('default_chat_source_id', defaultChatSourceId);
    if (defaultSearchSourceId !== undefined) await ragflowService.saveSystemConfig('default_search_source_id', defaultSearchSourceId);
    res.json({ success: true });
  } catch (error) {
    log.error('Error updating config', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/ragflow/sources
 * Add or Update a source.
 */
router.post('/sources', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id, type, name, url } = req.body;

    if (id) {
      await ragflowService.updateSource(id, name, url);
    } else {
      if (!type || !name || !url) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      await ragflowService.addSource(type, name, url);
    }
    res.json({ success: true });
  } catch (error) {
    log.error('Error saving source', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/ragflow/sources/:id
 * Delete a source.
 */
router.delete('/sources/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      res.status(400).json({ error: 'Missing definition ID' });
      return;
    }
    await ragflowService.deleteSource(req.params.id);
    res.json({ success: true });
  } catch (error) {
    log.error('Error deleting source', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
