import { Router } from 'express';
import { SystemToolsController } from '@/controllers/system-tools.controller.js';
import { requirePermission } from '@/middleware/auth.middleware.js';

const router = Router();
const controller = new SystemToolsController();

router.get('/', requirePermission('view_system_tools'), controller.getTools.bind(controller));
router.get('/health', requirePermission('view_system_tools'), controller.getHealth.bind(controller));
router.post('/:id/run', requirePermission('manage_system'), controller.runTool.bind(controller));

export default router;
