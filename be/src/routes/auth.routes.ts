import { Router } from 'express'
import { AuthController } from '@/controllers/auth.controller.js'
import { requireAuth } from '@/middleware/auth.middleware.js'

const router = Router()
const controller = new AuthController()

// Public endpoint exposing frontend auth configuration (client IDs, flags)
router.get('/config', controller.getAuthConfig.bind(controller));
// Returns the current authenticated user (session-backed)
router.get('/me', controller.getMe.bind(controller));
// Initiates Azure AD OAuth login
router.get('/login', controller.loginAzureAd.bind(controller));
// OAuth callback handler; completes session creation
router.get('/callback', controller.handleCallback.bind(controller));
// Session logout; requires existing auth
router.post('/logout', requireAuth, controller.logout.bind(controller));
// Prompts user to re-enter credentials (refreshes auth timestamps)
router.post('/reauth', requireAuth, controller.reauth.bind(controller));
// Refresh access token using stored refresh token
router.post('/refresh-token', requireAuth, controller.refreshToken.bind(controller));
// Reports token freshness/expiry for client-side decisions
router.get('/token-status', requireAuth, controller.getTokenStatus.bind(controller));
// Root user (local) login path for bootstrap/admin emergency access
router.post('/login/root', controller.loginRoot.bind(controller));

export default router;
