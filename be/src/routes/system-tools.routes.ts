import { Router } from 'express'
import { SystemToolsController } from '@/controllers/system-tools.controller.js'
import { requirePermission } from '@/middleware/auth.middleware.js'

const router = Router()
const controller = new SystemToolsController()

// Lists available system tools and their metadata
router.get('/', requirePermission('view_system_tools'), controller.getTools.bind(controller))
// Returns health status for system tools (connectivity, readiness)
router.get('/health', requirePermission('view_system_tools'), controller.getHealth.bind(controller))
// Executes a specific tool by id (privileged)
router.post('/:id/run', requirePermission('manage_system'), controller.runTool.bind(controller))

export default router
