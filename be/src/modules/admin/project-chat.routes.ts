
/**
 * Routes for project chat assistant API endpoints.
 * Nested under /api/projects/:projectId/chats.
 */
import { Router } from 'express'
import { ProjectChatController } from '@/modules/admin/project-chat.controller.js'
import { requireAuth } from '@/middleware/auth.middleware.js'

const router = Router({ mergeParams: true })

// Chat assistant CRUD
router.get('/', requireAuth, ProjectChatController.list)
router.get('/:chatId', requireAuth, ProjectChatController.getById)
router.post('/', requireAuth, ProjectChatController.create)
router.put('/:chatId', requireAuth, ProjectChatController.update)
router.delete('/:chatId', requireAuth, ProjectChatController.remove)

// Sync from RAGFlow
router.post('/:chatId/sync', requireAuth, ProjectChatController.sync)

export default router
