import { Router } from 'express';
import { AuthController } from '@/controllers/auth.controller.js';
import { requireAuth } from '@/middleware/auth.middleware.js';

const router = Router();
const controller = new AuthController();

router.get('/config', controller.getAuthConfig.bind(controller));
router.get('/me', controller.getMe.bind(controller));
router.get('/login', controller.loginAzureAd.bind(controller));
router.get('/callback', controller.handleCallback.bind(controller));
router.post('/logout', requireAuth, controller.logout.bind(controller));
router.post('/reauth', requireAuth, controller.reauth.bind(controller));
router.post('/refresh-token', requireAuth, controller.refreshToken.bind(controller));
router.get('/token-status', requireAuth, controller.getTokenStatus.bind(controller));
router.post('/login/root', controller.loginRoot.bind(controller));

export default router;
