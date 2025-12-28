
import { Router } from 'express';
import { promptPermissionController } from '@/controllers/prompt-permission.controller.js';
import { requireAuth, requireRole } from '@/middleware/auth.middleware.js';

const router = Router();

// Get current user's effective permission - available to all authenticated users
router.get('/my', requireAuth, promptPermissionController.getMyPermission);

// Management endpoints - Admin only
router.get('/', requireAuth, requireRole('admin'), promptPermissionController.getPermissions);
router.post('/', requireAuth, requireRole('admin'), promptPermissionController.setPermission);

export default router;
