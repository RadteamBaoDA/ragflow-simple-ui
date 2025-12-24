
import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { requireRole } from '../middleware/auth.middleware.js';

const router = Router();
const controller = new AdminController();

router.get('/dashboard', requireRole('admin'), controller.getDashboardStats.bind(controller));

export default router;
