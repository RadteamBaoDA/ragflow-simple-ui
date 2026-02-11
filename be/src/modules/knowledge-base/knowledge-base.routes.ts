
/**
 * Knowledge Base Routes
 * Manages configuration and data sources for RAG contexts.
 */
import { Router } from 'express'
import { KnowledgeBaseController } from '@/modules/knowledge-base/knowledge-base.controller.js'
import { requirePermission, requireAuth } from '@/shared/middleware/auth.middleware.js'

const router = Router()
const controller = new KnowledgeBaseController()

/**
 * @route GET /api/knowledge-base/config
 * @description Fetches KB iframe URLs and feature flags for the frontend shell.
 * @access Private
 */
// General config access for authenticated users (e.g., rendering the interface)
router.get('/config', requireAuth, controller.getConfig.bind(controller))

/**
 * @route POST /api/knowledge-base/config
 * @description Updates KB iframe configuration; restricted to maintainers.
 * @access Private (Manage Knowledge Base)
 */
// Configuration updates require specialized permission
router.post('/config', requirePermission('manage_knowledge_base'), controller.updateConfig.bind(controller))

/**
 * @route GET /api/knowledge-base/sources
 * @description List all registered knowledge base sources.
 * @access Private (Manage Knowledge Base)
 */
// List sources for administration
router.get('/sources', requirePermission('manage_knowledge_base'), controller.getSources.bind(controller))

/**
 * @route POST /api/knowledge-base/sources
 * @description Register a new knowledge base source.
 * @access Private (Manage Knowledge Base)
 */
// Create new source entry
router.post('/sources', requirePermission('manage_knowledge_base'), controller.createSource.bind(controller))

/**
 * @route PUT /api/knowledge-base/sources/:id
 * @description Update an existing knowledge base source.
 * @access Private (Manage Knowledge Base)
 */
// Modify existing source details
router.put('/sources/:id', requirePermission('manage_knowledge_base'), controller.updateSource.bind(controller))

/**
 * @route DELETE /api/knowledge-base/sources/:id
 * @description Delete a knowledge base source.
 * @access Private (Manage Knowledge Base)
 */
// Remove source from registry
router.delete('/sources/:id', requirePermission('manage_knowledge_base'), controller.deleteSource.bind(controller))

export default router
