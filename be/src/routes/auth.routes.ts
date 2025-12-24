/**
 * @fileoverview Authentication routes for Azure Entra ID OAuth2 and development mode.
 * 
 * This module handles:
 * - OAuth2 login flow with Azure AD (PKCE)
 * - OAuth callback processing and token exchange
 * - Session management and logout
 * - Development mode authentication bypass
 * - Root user authentication for local deployments
 * 
 * Security features:
 * - CSRF protection via OAuth state parameter
 * - Session regeneration on login/logout
 * - In-memory state store with TTL for OAuth states
 * 
 * @module routes/auth
 */

import { Router, Request, Response } from 'express';
import { getCurrentUser, updateAuthTimestamp, REAUTH_REQUIRED_ERROR } from '../middleware/auth.middleware.js';
import { config } from '../config/index.js';
import { log } from '../services/logger.service.js';
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getUserProfile,
  generateState,
  refreshAccessToken,
  isTokenExpired,
} from '../services/auth.service.js';
import { userService } from '../services/user.service.js';

const router = Router();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract client IP from request headers.
 * Checks X-Forwarded-For (nginx), X-Real-IP, then socket address.
 */
function getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    
    if (typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0]?.trim() || 'unknown';
    }
    if (typeof realIp === 'string') {
        return realIp;
    }
    return req.socket.remoteAddress || 'unknown';
}

// ============================================================================
// OAuth State Management
// ============================================================================

/**
 * OAuth state data stored in memory for CSRF protection.
 * This is the PRIMARY store since session cookies may not persist
 * across different ports (frontend proxy vs direct backend access).
 */
interface OAuthStateData {
  /** Timestamp when state was created (for TTL calculation) */
  timestamp: number;
  /** Optional redirect URL after successful login */
  redirectUrl?: string;
  /** Session ID associated with this state */
  sessionId?: string;
}

/** In-memory store for OAuth states with TTL cleanup */
const oauthStateStore = new Map<string, OAuthStateData>();

/** Time-to-live for OAuth states (10 minutes) */
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Validate and sanitize redirect URL to prevent open redirect attacks.
 * Per OWASP: Only allow redirects to same-origin or trusted domains.
 * 
 * @param redirectUrl - The redirect URL to validate
 * @returns Sanitized URL or null if invalid
 */
function validateRedirectUrl(redirectUrl: string | undefined): string | null {
  if (!redirectUrl || typeof redirectUrl !== 'string') {
    return null;
  }
  
  // Limit URL length to prevent DoS
  if (redirectUrl.length > 2048) {
    return null;
  }
  
  try {
    // Parse the URL
    const url = new URL(redirectUrl, config.frontendUrl);
    
    // Only allow http/https protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      log.warn('Rejected redirect URL with invalid protocol', { redirectUrl });
      return null;
    }
    
    // Get trusted domains from config
    const frontendHost = new URL(config.frontendUrl).host;
    const sharedDomain = config.sharedStorageDomain.startsWith('.')
      ? config.sharedStorageDomain.substring(1)
      : config.sharedStorageDomain;
    
    // Check if redirect is to a trusted domain
    const isTrustedDomain = 
      url.host === frontendHost ||
      url.host === sharedDomain ||
      url.host.endsWith('.' + sharedDomain);
    
    if (!isTrustedDomain) {
      log.warn('Rejected redirect URL to untrusted domain', {
        redirectUrl,
        urlHost: url.host,
        frontendHost,
        sharedDomain,
      });
      return null;
    }
    
    return url.toString();
  } catch (e) {
    // If it's a relative path, allow it
    if (redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) {
      // Ensure no URL-encoded tricks
      const decoded = decodeURIComponent(redirectUrl);
      if (decoded.startsWith('/') && !decoded.includes('://')) {
        return redirectUrl;
      }
    }
    
    log.warn('Rejected invalid redirect URL', { redirectUrl });
    return null;
  }
}

/**
 * Periodic cleanup of expired OAuth states.
 * Runs every minute to prevent memory leaks.
 */
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  for (const [state, data] of oauthStateStore.entries()) {
    if (now - data.timestamp > STATE_TTL_MS) {
      oauthStateStore.delete(state);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    log.debug('Cleaned up expired OAuth states', { count: cleanedCount });
  }
}, 60 * 1000);

// ============================================================================
// Development Mode Configuration
// ============================================================================

/**
 * Development-only mock user for testing UI without Azure AD.
 * Only available when NODE_ENV === 'development'.
 */
const DEV_USER = config.nodeEnv === 'development' ? {
  id: 'dev-user-001',
  email: 'john.doe@contoso.com',
  name: 'John Doe',
  displayName: 'John Doe',
  avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=3b82f6&color=fff&size=128',
} : null;

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/auth/me
 * Get current authenticated user.
 * 
 * Returns user info that can be stored in shared storage for cross-subdomain access.
 * Includes _sharedStorage metadata for frontend synchronization.
 * Also records the client IP address for audit purposes (via X-Forwarded-For from nginx).
 * 
 * @returns {Object} User object with shared storage metadata
 * @returns {401} If no user is authenticated
 */
router.get('/me', async (req: Request, res: Response) => {
  const user = getCurrentUser(req);

  log.debug('Auth /me request', {
    hasUser: !!user,
    hasSessionUser: !!req.session?.user,
    sessionId: req.sessionID?.substring(0, 8),
    nodeEnv: config.nodeEnv,
    cookieHeader: req.headers.cookie?.substring(0, 50),
  });

  // Check if user exists in session (authenticated via Azure AD)
  if (user) {
    log.debug('Returning authenticated user', { userId: user.id, email: user.email });
    
    // Extract client IP from X-Forwarded-For header (set by nginx proxy)
    // Falls back to X-Real-IP, then to socket remote address
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    let clientIp: string = 'unknown';
    
    if (typeof forwardedFor === 'string') {
      // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
      // The first one is the original client IP
      clientIp = forwardedFor.split(',')[0]?.trim() || 'unknown';
    } else if (typeof realIp === 'string') {
      clientIp = realIp;
    } else if (req.socket.remoteAddress) {
      clientIp = req.socket.remoteAddress;
    }

    // Record the IP asynchronously (don't block the response)
    userService.recordUserIp(user.id, clientIp).catch(err => {
      log.warn('Failed to record user IP in /me endpoint', { error: err });
    });

    res.json({
      ...user,
      _sharedStorage: {
        domain: config.sharedStorageDomain,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // No user in session - return 401
  // NOTE: Dev mode auto-login has been removed to fix logout issues
  // Use the "Continue as Dev User" button on the login page for development
  log.debug('No user in session, returning 401');
  res.status(401).json({ error: 'Not authenticated' });
});

/**
 * POST /api/auth/dev-login
 * Development only: Login as dev user without Azure AD.
 * 
 * This creates an actual session, unlike the removed auto-dev-user fallback.
 * Regenerates session to prevent session fixation attacks.
 * 
 * @body {string} [redirect] - Optional URL to redirect after login
 * @returns {Object} Success status, user object, and redirect URL
 * @returns {403} If not in development mode
 */
router.post('/dev-login', (req: Request, res: Response) => {
  // Only allow in development mode
  if (config.nodeEnv !== 'development' || !DEV_USER) {
    log.warn('Dev login attempted in non-development environment');
    res.status(403).json({ error: 'Dev login only available in development mode' });
    return;
  }

  // Validate redirect URL to prevent open redirect attacks
  const redirectUrl = validateRedirectUrl(req.body?.redirect as string | undefined);

  log.debug('Dev user login initiated');

  // Regenerate session to prevent session fixation and ensure clean state
  req.session.regenerate((err) => {
    if (err) {
      log.error('Failed to regenerate session for dev login', { error: err.message });
      res.status(500).json({ error: 'Failed to create session' });
      return;
    }

    // Store dev user in session
    req.session.user = DEV_USER;
    
    // Set authentication timestamp for session security
    updateAuthTimestamp(req, false);

    req.session.save((err) => {
      if (err) {
        log.error('Failed to save dev user session', { error: err.message });
        res.status(500).json({ error: 'Failed to create session' });
        return;
      }

      log.debug('Dev user logged in successfully', {
        userId: DEV_USER.id,
        sessionId: req.sessionID?.substring(0, 8),
      });

      res.json({
        success: true,
        user: DEV_USER,
        redirectUrl: redirectUrl || '/',
      });
    });
  });
});

/**
 * GET /api/auth/login
 * Initiate Azure Entra ID OAuth2 login flow.
 * 
 * Flow:
 * 1. Regenerate session for clean state
 * 2. Generate CSRF state token
 * 3. Store state in memory (primary) and session (fallback)
 * 4. Redirect to Azure AD authorization endpoint
 * 
 * @query {string} [redirect] - URL to redirect after successful login
 */
router.get('/login', (req: Request, res: Response) => {
  // Generate state for CSRF protection
  const state = generateState();
  
  // Validate redirect URL to prevent open redirect attacks
  const redirectUrl = validateRedirectUrl(req.query['redirect'] as string | undefined);

  // Regenerate session before starting OAuth flow to ensure clean state
  req.session.regenerate((err) => {
    if (err) {
      log.error('Failed to regenerate session for OAuth login', { error: err.message });
      res.redirect(`${config.frontendUrl}/login?error=session_error`);
      return;
    }

    // Store state in memory store (PRIMARY - always works)
    // Session-based state may fail due to port differences between frontend proxy and callback
    const stateData: OAuthStateData = {
      timestamp: Date.now(),
      sessionId: req.sessionID,
    };

    if (redirectUrl) {
      stateData.redirectUrl = redirectUrl;
    }

    oauthStateStore.set(state, stateData);

    // Also try to store in session (may not work across ports)
    req.session.oauthState = state;

    log.info('OAuth login initiated', {
      state: state.substring(0, 8) + '...',
      sessionId: req.sessionID?.substring(0, 8),
      redirect: redirectUrl,
      storeSize: oauthStateStore.size,
    });

    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        log.error('Failed to save session before OAuth redirect', { error: err.message });
      }
      const authUrl = getAuthorizationUrl(state);
      log.debug('Redirecting to Azure AD', { authUrl: authUrl.substring(0, 100) + '...' });
      res.redirect(authUrl);
    });
  });
});

/**
 * GET /api/auth/callback
 * Handle OAuth callback from Azure Entra ID.
 * 
 * Processing steps:
 * 1. Validate OAuth state (CSRF protection)
 * 2. Exchange authorization code for tokens
 * 3. Fetch user profile from Microsoft Graph API
 * 4. Find or create user in database
 * 5. Store user in session with role/permissions
 * 6. Redirect to frontend
 * 
 * @query {string} code - Authorization code from Azure AD
 * @query {string} state - State parameter for CSRF validation
 * @query {string} [error] - Error code from Azure AD
 * @query {string} [error_description] - Error description from Azure AD
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  // Get state data from memory store (PRIMARY method)
  const memoryStateData = typeof state === 'string' ? oauthStateStore.get(state) : undefined;
  const sessionState = req.session.oauthState;

  log.debug('OAuth callback received', {
    hasCode: !!code,
    hasState: !!state,
    hasError: !!error,
    receivedState: typeof state === 'string' ? state.substring(0, 8) : undefined,
    sessionState: sessionState?.substring(0, 8) ?? 'missing',
    memoryStateFound: !!memoryStateData,
    sessionId: req.sessionID?.substring(0, 8),
    storeSize: oauthStateStore.size,
    storedStates: Array.from(oauthStateStore.keys()).map(k => k.substring(0, 8)),
  });

  // Handle OAuth errors
  if (error) {
    log.error('OAuth error from Azure AD', { error, error_description });
    res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(String(error_description ?? error))}`);
    return;
  }

  // Validate state - memory store is PRIMARY, session is fallback
  // Memory store handles the case where session cookies don't persist across ports
  const stateValid = memoryStateData !== undefined || (state && state === sessionState);

  if (!state || !stateValid) {
    log.error('OAuth state validation failed', {
      receivedState: typeof state === 'string' ? state.substring(0, 8) : 'missing',
      sessionState: sessionState?.substring(0, 8) ?? 'missing',
      memoryStateFound: !!memoryStateData,
      sessionId: req.sessionID?.substring(0, 8),
      storeSize: oauthStateStore.size,
    });
    res.redirect(`${config.frontendUrl}/login?error=invalid_state`);
    return;
  }

  // Clean up state from memory store
  if (typeof state === 'string') {
    oauthStateStore.delete(state);
  }

  if (!code || typeof code !== 'string') {
    log.error('OAuth callback missing authorization code');
    res.redirect(`${config.frontendUrl}/login?error=missing_code`);
    return;
  }

  try {
    log.debug('Exchanging authorization code for tokens');

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    log.debug('Token exchange successful');

    // Get user profile from Microsoft Graph
    log.debug('Fetching user profile from Microsoft Graph');
    const user = await getUserProfile(tokens.access_token);
    log.debug('User authenticated successfully', {
      userId: user.id,
      email: user.email,
      name: user.displayName,
    });

    // Store user in session
    // Auto-save user to database
    const dbUser = await userService.findOrCreateUser(user, getClientIp(req));

    // Merge Azure AD profile with DB user data (role, permissions)
    req.session.user = {
      ...user,
      role: dbUser.role,
      permissions: dbUser.permissions,
    };
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;
    // Token expires_in is in seconds, convert to Unix timestamp (ms)
    req.session.tokenExpiresAt = Date.now() + (tokens.expires_in * 1000);

    // Set authentication timestamps for session security
    updateAuthTimestamp(req, false);

    // Clear OAuth state from session
    delete req.session.oauthState;

    // Note: Login events are logged via logger.service.ts, not audit_logs table (saves DB space)

    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        log.error('Failed to save session after login', { error: err.message });
      }

      // Get redirect URL from memory state data or default to frontend
      // Re-validate stored redirect URL before use
      const storedRedirect = memoryStateData?.redirectUrl;
      const validatedRedirect = storedRedirect ? validateRedirectUrl(storedRedirect) : null;
      const finalRedirectUrl = validatedRedirect || config.frontendUrl;
      log.debug('Login complete, redirecting', { redirectUrl: finalRedirectUrl });
      res.redirect(finalRedirectUrl);
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error('OAuth callback error', { error: errorMessage, stack: err instanceof Error ? err.stack : undefined });
    res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
  }
});

/**
 * GET /api/auth/logout
 * Logout the current user (local session only, not Azure AD).
 * 
 * This performs a local logout only, allowing users to
 * login with a different Azure account without logging out of Azure.
 * 
 * Steps:
 * 1. Destroy server session
 * 2. Clear session cookie
 * 3. Redirect to login page
 */
router.get('/logout', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  log.debug('User logout initiated', { userId: user?.id, email: user?.email });

  // Note: Logout events are logged via logger.service.ts, not audit_logs table (saves DB space)

  // Clear session first, then redirect to login page
  req.session.destroy((err) => {
    if (err) {
      log.error('Session destroy error during logout', { error: err.message });
    }

    // Clear session cookie
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: config.https.enabled,
      sameSite: 'lax',
      domain: config.sharedStorageDomain !== '.localhost' ? config.sharedStorageDomain : undefined,
    });

    // Redirect directly to login page (local logout only, not Azure AD logout)
    // This allows users to login with a different Azure account without logging out of Azure
    const loginPageUrl = `${config.frontendUrl}/login`;
    log.debug('User logged out, redirecting to login page', { redirectUrl: loginPageUrl });
    res.redirect(loginPageUrl);
  });
});

/**
 * POST /api/auth/logout
 * Logout via POST (for programmatic logout from frontend).
 * 
 * Returns JSON response instead of redirect.
 * 
 * @returns {Object} Success message and redirect URL
 * @returns {500} If session destruction fails
 */
router.post('/logout', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  log.debug('User logout (POST) initiated', { userId: user?.id, email: user?.email });

  req.session.destroy((err) => {
    if (err) {
      log.error('Session destroy error during POST logout', { error: err.message });
      res.status(500).json({ error: 'Logout failed' });
      return;
    }

    // Clear session cookie
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: config.https.enabled,
      sameSite: 'lax',
      domain: config.sharedStorageDomain !== '.localhost' ? config.sharedStorageDomain : undefined,
    });

    log.debug('User logged out successfully');
    res.json({
      message: 'Logged out successfully',
      redirectUrl: `${config.frontendUrl}/login`,
    });
  });
});

/**
 * GET /api/auth/config
 * Get public authentication configuration.
 * 
 * Returns configuration flags for frontend authentication UI.
 * 
 * @returns {Object} Auth config with enableRootLogin flag
 */
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    enableRootLogin: config.enableRootLogin,
  });
});

/**
 * POST /api/auth/reauth
 * Re-authenticate the current user for sensitive operations.
 * 
 * This endpoint refreshes the authentication timestamp without requiring
 * full re-login. For Azure AD users, it can optionally validate against
 * a current access token. For root users, it requires password verification.
 * 
 * Use cases:
 * - Before role/permission changes
 * - Before bulk file deletions
 * - Before account modifications
 * 
 * @body {string} [password] - Required for root users
 * @returns {Object} Success status with new auth timestamp
 * @returns {401} If not authenticated or password invalid
 */
router.post('/reauth', async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  log.debug('Re-authentication requested', { userId: user.id, email: user.email });

  // For root users, require password verification
  if (user.id === 'root-user') {
    const { password } = req.body;
    
    if (typeof password !== 'string') {
      res.status(400).json({ error: 'Password required for root user re-authentication' });
      return;
    }
    
    const rootPass = process.env['KB_ROOT_PASSWORD'] || 'admin';
    
    // Use constant-time comparison
    const crypto = await import('crypto');
    const passwordMatch = crypto.timingSafeEqual(
      Buffer.from(password.padEnd(256, '\0')),
      Buffer.from(rootPass.padEnd(256, '\0'))
    );
    
    if (!passwordMatch) {
      // Add delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
      log.warn('Root user re-authentication failed', { userId: user.id });
      res.status(401).json({ error: 'Invalid password' });
      return;
    }
  }
  
  // For Azure AD users, verify session is still valid
  // If we have an access token, optionally verify it hasn't been revoked
  // (For now, we trust the session - token validation can be added later)
  
  // Update re-authentication timestamp
  updateAuthTimestamp(req, true);
  
  req.session.save((err) => {
    if (err) {
      log.error('Failed to save session after re-auth', { error: err.message });
      res.status(500).json({ error: 'Re-authentication failed' });
      return;
    }
    
    log.debug('Re-authentication successful', { userId: user.id });
    res.json({
      success: true,
      message: 'Re-authentication successful',
      lastReauthAt: req.session.lastReauthAt,
    });
  });
});

/**
 * POST /api/auth/refresh-token
 * Refresh the Azure AD access token using the stored refresh token.
 * 
 * This endpoint enables shorter-lived access tokens while maintaining
 * longer session lifetimes. The frontend should call this before making
 * API calls that require a valid access token.
 * 
 * Token Lifecycle:
 * - Access tokens: ~1 hour (Azure AD default)
 * - Refresh tokens: 90 days or until revoked
 * - Sessions: 7 days (configurable)
 * 
 * @returns {Object} Token status and new expiry time
 * @returns {401} If not authenticated or refresh token invalid
 */
router.post('/refresh-token', async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Root users don't have tokens to refresh
  if (user.id === 'root-user') {
    res.json({
      success: true,
      message: 'Root user does not require token refresh',
      isRootUser: true,
    });
    return;
  }

  // Check if we have a refresh token
  const refreshToken = req.session.refreshToken;
  if (!refreshToken) {
    log.warn('Token refresh requested but no refresh token in session', { userId: user.id });
    res.status(401).json({ 
      error: 'NO_REFRESH_TOKEN',
      message: 'No refresh token available. Please re-authenticate.',
    });
    return;
  }

  // Check if token actually needs refreshing
  const tokenExpiresAt = req.session.tokenExpiresAt;
  if (!isTokenExpired(tokenExpiresAt)) {
    const expiresIn = tokenExpiresAt ? Math.floor((tokenExpiresAt - Date.now()) / 1000) : 0;
    res.json({
      success: true,
      message: 'Token still valid',
      expiresIn,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null,
    });
    return;
  }

  try {
    log.debug('Refreshing access token', { userId: user.id });
    
    const newTokens = await refreshAccessToken(refreshToken);
    
    // Update session with new tokens
    req.session.accessToken = newTokens.access_token;
    req.session.tokenExpiresAt = Date.now() + (newTokens.expires_in * 1000);
    
    // Azure AD may rotate the refresh token
    if (newTokens.refresh_token) {
      req.session.refreshToken = newTokens.refresh_token;
    }

    req.session.save((err) => {
      if (err) {
        log.error('Failed to save session after token refresh', { error: err.message });
        res.status(500).json({ error: 'Failed to save refreshed token' });
        return;
      }

      log.debug('Access token refreshed successfully', { 
        userId: user.id,
        expiresIn: newTokens.expires_in 
      });
      
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        expiresIn: newTokens.expires_in,
        tokenExpiresAt: new Date(req.session.tokenExpiresAt!).toISOString(),
      });
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('Token refresh failed', { userId: user.id, error: errMsg });
    
    // If refresh fails, the user needs to re-authenticate
    res.status(401).json({
      error: 'TOKEN_REFRESH_FAILED',
      message: 'Failed to refresh token. Please re-authenticate.',
    });
  }
});

/**
 * GET /api/auth/token-status
 * Get the current access token status.
 * 
 * Useful for frontend to check if token refresh is needed before API calls.
 * 
 * @returns {Object} Token expiry status
 */
router.get('/token-status', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (user.id === 'root-user') {
    res.json({
      hasToken: false,
      isRootUser: true,
      message: 'Root user does not use tokens',
    });
    return;
  }

  const tokenExpiresAt = req.session.tokenExpiresAt;
  const hasRefreshToken = !!req.session.refreshToken;
  const expired = isTokenExpired(tokenExpiresAt);
  const expiresIn = tokenExpiresAt ? Math.max(0, Math.floor((tokenExpiresAt - Date.now()) / 1000)) : 0;

  res.json({
    hasToken: !!req.session.accessToken,
    hasRefreshToken,
    expired,
    expiresIn,
    tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null,
    lastAuthAt: req.session.lastAuthAt ? new Date(req.session.lastAuthAt).toISOString() : null,
    lastReauthAt: req.session.lastReauthAt ? new Date(req.session.lastReauthAt).toISOString() : null,
  });
});

/**
 * POST /api/auth/login/root
 * Login with root credentials (local deployment only).
 * 
 * Authenticates using KB_ROOT_USER and KB_ROOT_PASSWORD environment variables.
 * Only available when ENABLE_ROOT_LOGIN is true.
 * 
 * @body {string} username - Root username
 * @body {string} password - Root password
 * @returns {Object} Success status and user object
 * @returns {403} If root login is disabled
 * @returns {401} If credentials are invalid
 */
router.post('/login/root', async (req: Request, res: Response) => {
  if (!config.enableRootLogin) {
    res.status(403).json({ error: 'Root login is disabled' });
    return;
  }

  const { username, password } = req.body;
  
  // Input validation
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  
  // Limit input length to prevent DoS
  if (username.length > 255 || password.length > 255) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  
  const rootUser = process.env['KB_ROOT_USER'] || 'admin@localhost';
  const rootPass = process.env['KB_ROOT_PASSWORD'] || 'admin';

  // Use constant-time comparison to prevent timing attacks
  const crypto = await import('crypto');
  const usernameMatch = crypto.timingSafeEqual(
    Buffer.from(username.padEnd(256, '\0')),
    Buffer.from(rootUser.padEnd(256, '\0'))
  );
  const passwordMatch = crypto.timingSafeEqual(
    Buffer.from(password.padEnd(256, '\0')),
    Buffer.from(rootPass.padEnd(256, '\0'))
  );
  
  if (!usernameMatch || !passwordMatch) {
    // Add small delay to further prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  try {
    // Find or create root user in DB to ensure consistency
    const user = await userService.findOrCreateUser({
      id: 'root-user',
      email: rootUser,
      name: 'System Administrator',
      displayName: 'System Administrator',
    }, getClientIp(req));

    // Create session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: 'System Administrator',
      displayName: user.display_name,
      role: 'admin',
      permissions: ['*'], // Root has all permissions
    };

    // Set authentication timestamp for session security
    updateAuthTimestamp(req, false);

    // Note: Login events are logged via logger.service.ts, not audit_logs table (saves DB space)

    log.debug('Root user logged in', { email: rootUser });
    
    // Save session before responding
    req.session.save((saveErr) => {
      if (saveErr) {
        log.error('Failed to save root user session', { error: saveErr.message });
        res.status(500).json({ error: 'Login failed' });
        return;
      }
      res.json({ success: true, user: req.session.user });
    });
  } catch (error) {
    log.error('Root login failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
