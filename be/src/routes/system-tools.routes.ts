
/**
 * System Tools Routes
 * Endpoints for running system diagnostics and maintenance tools.
 */
import { Router } from 'express'
import { SystemToolsController } from '@/controllers/system-tools.controller.js'
import { requirePermission } from '@/middleware/auth.middleware.js'

const router = Router()
const controller = new SystemToolsController()

/**
 * @route GET /api/system-tools
 * @description Lists available system tools and their metadata.
 * @access Private (View System Tools)
 */
// Returns list of registered diagnostic tools
router.get('/', requirePermission('view_system_tools'), controller.getTools.bind(controller))

/**
 * @route GET /api/system-tools/health
 * @description Returns health status for system tools (connectivity, readiness).
 * @access Private (View System Tools)
 */
// Checks status of underlying services used by tools
router.get('/health', requirePermission('view_system_tools'), controller.getHealth.bind(controller))

/**
 * @route POST /api/system-tools/:id/run
 * @description Executes a specific tool by id (privileged).
 * @access Private (Manage System)
 */
// Trigger tool execution restricted to system managers
router.post('/:id/run', requirePermission('manage_system'), controller.runTool.bind(controller))

export default router
