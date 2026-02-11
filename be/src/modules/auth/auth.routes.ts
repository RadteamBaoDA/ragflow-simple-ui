
/**
 * Authentication Routes
 * Handles user login (Azure AD & Root), logout, token management, and session checks.
 */
import { Router } from 'express'
import { AuthController } from '@/modules/auth/auth.controller.js'
import { requireAuth } from '@/shared/middleware/auth.middleware.js'

const router = Router()
const controller = new AuthController()

/**
 * @route GET /api/auth/config
 * @description Public endpoint exposing frontend auth configuration (client IDs, flags).
 * @access Public
 */
// Return public auth config to frontend (e.g. for MSAL initialization)
router.get('/config', controller.getAuthConfig.bind(controller));

/**
 * @route GET /api/auth/me
 * @description Returns the current authenticated user (session-backed).
 * @access Public (Returns null or 401 if not authenticated)
 */
// Check and return current user session
router.get('/me', controller.getMe.bind(controller));

/**
 * @route GET /api/auth/login
 * @description Initiates Azure AD OAuth login flow.
 * @access Public
 */
// Start OAuth flow redirect
router.get('/login', controller.loginAzureAd.bind(controller));

/**
 * @route GET /api/auth/callback
 * @description OAuth callback handler; completes session creation.
 * @access Public
 */
// Handle OAuth redirect response and create session
router.get('/callback', controller.handleCallback.bind(controller));

/**
 * @route POST /api/auth/logout
 * @description Session logout; requires existing auth.
 * @access Private
 */
// Destroy user session
router.post('/logout', requireAuth, controller.logout.bind(controller));

/**
 * @route POST /api/auth/reauth
 * @description Prompts user to re-enter credentials (refreshes auth timestamps).
 * @access Private
 */
// Refresh session validity timestamp
router.post('/reauth', requireAuth, controller.reauth.bind(controller));

/**
 * @route POST /api/auth/refresh-token
 * @description Refresh access token using stored refresh token.
 * @access Private
 */
// External provider token refresh
router.post('/refresh-token', requireAuth, controller.refreshToken.bind(controller));

/**
 * @route GET /api/auth/token-status
 * @description Reports token freshness/expiry for client-side decisions.
 * @access Private
 */
// Check if token is nearing expiry
router.get('/token-status', requireAuth, controller.getTokenStatus.bind(controller));

/**
 * @route POST /api/auth/login/root
 * @description Root user (local) login path for bootstrap/admin emergency access.
 * @access Public
 */
// Authenticate using local root credentials config
router.post('/login/root', controller.loginRoot.bind(controller));

export default router;
