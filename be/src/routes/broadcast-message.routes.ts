/**
 * @fileoverview API routes for broadcast messages.
 */

import { Router } from 'express';
import { BroadcastMessageController } from '@/controllers/broadcast-message.controller.js';
import { requirePermission } from '@/middleware/auth.middleware.js';

const router = Router();
const controller = new BroadcastMessageController();

/**
 * GET /api/broadcast-messages/active
 * Fetch active messages, optionally filtered by user dismissal.
 */
router.get('/active', controller.getActive.bind(controller));

/**
 * POST /api/broadcast-messages/:id/dismiss
 * Record dismissal of a broadcast message for the current user.
 */
router.post('/:id/dismiss', controller.dismiss.bind(controller));

/**
 * Admin routes (prefixed with /api/broadcast-messages/admin or handled via permission check)
 */

/**
 * GET /api/broadcast-messages
 * List all messages (requires manage_system permission).
 */
router.get('/', requirePermission('manage_system'), controller.getAll.bind(controller));

/**
 * POST /api/broadcast-messages
 * Create a message.
 */
router.post('/', requirePermission('manage_system'), controller.create.bind(controller));

/**
 * PUT /api/broadcast-messages/:id
 * Update a message.
 */
router.put('/:id', requirePermission('manage_system'), controller.update.bind(controller));

/**
 * DELETE /api/broadcast-messages/:id
 * Delete a message.
 */
router.delete('/:id', requirePermission('manage_system'), controller.delete.bind(controller));

export default router;
