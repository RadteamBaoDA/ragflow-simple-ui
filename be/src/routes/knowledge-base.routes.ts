
import { Router } from 'express';
import { KnowledgeBaseController } from '@/controllers/knowledge-base.controller.js';
import { requirePermission, requireAuth } from '@/middleware/auth.middleware.js';

const router = Router();
const controller = new KnowledgeBaseController();

router.get('/config', requireAuth, controller.getConfig.bind(controller));
router.post('/config', requirePermission('manage_knowledge_base'), controller.updateConfig.bind(controller));
router.get('/sources', requirePermission('manage_knowledge_base'), controller.getSources.bind(controller));
router.post('/sources', requirePermission('manage_knowledge_base'), controller.createSource.bind(controller));
router.put('/sources/:id', requirePermission('manage_knowledge_base'), controller.updateSource.bind(controller));
router.delete('/sources/:id', requirePermission('manage_knowledge_base'), controller.deleteSource.bind(controller));

export default router;
