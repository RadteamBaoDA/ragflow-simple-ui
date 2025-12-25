import { Router } from 'express'
import { KnowledgeBaseController } from '@/controllers/knowledge-base.controller.js'
import { requirePermission, requireAuth } from '@/middleware/auth.middleware.js'

const router = Router()
const controller = new KnowledgeBaseController()

// Fetches KB iframe URLs and feature flags for the frontend shell
router.get('/config', requireAuth, controller.getConfig.bind(controller))
// Updates KB iframe configuration; restricted to maintainers
router.post('/config', requirePermission('manage_knowledge_base'), controller.updateConfig.bind(controller))
// CRUD endpoints for registered knowledge base sources
router.get('/sources', requirePermission('manage_knowledge_base'), controller.getSources.bind(controller))
router.post('/sources', requirePermission('manage_knowledge_base'), controller.createSource.bind(controller))
router.put('/sources/:id', requirePermission('manage_knowledge_base'), controller.updateSource.bind(controller))
router.delete('/sources/:id', requirePermission('manage_knowledge_base'), controller.deleteSource.bind(controller))

export default router
