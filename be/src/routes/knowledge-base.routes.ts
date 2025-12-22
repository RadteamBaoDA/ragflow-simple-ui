/**
 * @fileoverview Knowledge Base configuration routes.
 * 
 * This module provides API endpoints for retrieving Knowledge Base
 * iframe configuration.
 * 
 * @module routes/knowledge-base
 */

import { Router, Request, Response } from 'express';
import { log } from '../services/logger.service.js';
import { requireAuth, requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { knowledgeBaseService } from '../services/knowledge-base.service.js';
import { teamService } from '../services/team.service.js';

const router = Router();

// ============================================================================
// Middleware
// ============================================================================

/** Apply authentication middleware to all routes */
router.use(requireAuth);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/knowledge-base/config
 * Returns Knowledge Base iframe URLs.
 */
router.get('/config', requirePermission('view_chat'), async (req: Request, res: Response) => {
    log.debug('Knowledge Base config requested');
    let userTeamIds: string[] = [];
    if (req.user) {
        const teams = await teamService.getUserTeams(req.user.id);
        userTeamIds = teams.map(t => t.id);
    }
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    // Ensure role is defined (default to 'user' if missing)
    const user = { ...req.user, role: req.user.role || 'user' };
    const config = await knowledgeBaseService.getConfig(user, userTeamIds);
    res.json(config);
});

/**
 * GET /api/knowledge-base/sources
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
            return;
        }

        const result = await knowledgeBaseService.getSourcesPaginated(type, page, limit);
        res.json(result);
    } catch (error) {
        log.error('Error fetching sources', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/config', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { defaultChatSourceId, defaultSearchSourceId } = req.body;
        if (defaultChatSourceId !== undefined) await knowledgeBaseService.saveSystemConfig('default_chat_source_id', defaultChatSourceId);
        if (defaultSearchSourceId !== undefined) await knowledgeBaseService.saveSystemConfig('default_search_source_id', defaultSearchSourceId);
        res.json({ success: true });
    } catch (error) {
        log.error('Error updating config', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/sources', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { type, name, url, access_control } = req.body;
        if (!type || !name || !url) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const source = await knowledgeBaseService.addSource(type, name, url, access_control);
        res.json(source);
    } catch (error) {
        log.error('Error adding source', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/sources/:id', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { name, url, access_control } = req.body;
        await knowledgeBaseService.updateSource(req.params.id as string, name, url, access_control);
        res.json({ success: true });
    } catch (error) {
        log.error('Error updating source', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/sources/:id', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        await knowledgeBaseService.deleteSource(req.params.id as string);
        res.json({ success: true });
    } catch (error) {
        log.error('Error deleting source', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export const knowledgeBaseRoutes = router;
