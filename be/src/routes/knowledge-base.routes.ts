
import { Router } from 'express';
import { KnowledgeBaseController } from '@/controllers/knowledge-base.controller.js';
import { requirePermission } from '@/middleware/auth.middleware.js';

const router = Router();
const controller = new KnowledgeBaseController();

router.get('/config', controller.getConfig.bind(controller));
router.get('/', requirePermission('manage_knowledge_base'), controller.getSources.bind(controller));
router.post('/', requirePermission('manage_knowledge_base'), controller.createSource.bind(controller));
router.put('/:id', requirePermission('manage_knowledge_base'), controller.updateSource.bind(controller));
router.delete('/:id', requirePermission('manage_knowledge_base'), controller.deleteSource.bind(controller));

export default router;
