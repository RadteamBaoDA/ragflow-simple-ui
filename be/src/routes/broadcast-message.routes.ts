
/**
 * @fileoverview API routes for broadcast messages.
 */

import { Router } from 'express'
import { BroadcastMessageController } from '@/controllers/broadcast-message.controller.js'
import { requirePermission } from '@/middleware/auth.middleware.js'

const router = Router()
const controller = new BroadcastMessageController()

/**
 * @route GET /api/broadcast-messages/active
 * @description Fetch active system broadcasts, filtered by user dismissal if authenticated.
 * @access Public/Private (Behavior differs)
 */
// Publicly accessible to show login announcements, but filters based on user context if available
router.get('/active', controller.getActive.bind(controller))

/**
 * @route POST /api/broadcast-messages/:id/dismiss
 * @description Record that the current user has dismissed a specific broadcast message.
 * @access Private
 */
// Allows authenticated users to hide specific announcements
router.post('/:id/dismiss', controller.dismiss.bind(controller))

/**
 * Admin routes (prefixed with /api/broadcast-messages/admin or handled via permission check)
 */

/**
 * @route GET /api/broadcast-messages
 * @description List all broadcast messages (active and inactive).
 * @access Private (System Managers)
 */
// Restricted to users with 'manage_system' permission
router.get('/', requirePermission('manage_system'), controller.getAll.bind(controller))

/**
 * @route POST /api/broadcast-messages
 * @description Create a new system-wide broadcast message.
 * @access Private (System Managers)
 */
// Restricted to users with 'manage_system' permission
router.post('/', requirePermission('manage_system'), controller.create.bind(controller))

/**
 * @route PUT /api/broadcast-messages/:id
 * @description Update an existing broadcast message.
 * @access Private (System Managers)
 */
// Restricted to users with 'manage_system' permission
router.put('/:id', requirePermission('manage_system'), controller.update.bind(controller))

/**
 * @route DELETE /api/broadcast-messages/:id
 * @description Delete a broadcast message.
 * @access Private (System Managers)
 */
// Restricted to users with 'manage_system' permission
router.delete('/:id', requirePermission('manage_system'), controller.delete.bind(controller))

export default router
