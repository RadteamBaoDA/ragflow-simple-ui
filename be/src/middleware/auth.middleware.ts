/**
 * @fileoverview Authentication and authorization middleware.
 * 
 * This module provides Express middleware for:
 * - Session-based authentication (requireAuth)
 * - Permission-based authorization (requirePermission)
 * - Role-based access control (requireRole)
 * - Resource ownership validation (requireOwnership)
 * - Optional authentication checking (checkSession)
 * 
 * Authentication is handled via express-session with user data
 * stored after successful Azure AD OAuth login.
 * 
 * Security: Implements OWASP Authorization Cheat Sheet recommendations:
 * - Deny by default (all protected routes return 401/403 if auth fails)
 * - Validate permissions on every request
 * - IDOR prevention via ownership checks
 * - Server-side authorization (never trust client-side)
 * - Safe failure (returns generic error, logs details)
 * - Comprehensive logging for security monitoring
 * 
 * @module middleware/auth
 * @example
 * import { requireAuth, requirePermission, requireOwnership } from './middleware/auth.middleware.js';
 * 
 * // Require authentication
 * router.get('/protected', requireAuth, handler);
 * 
 * // Require specific permission
 * router.post('/admin', requireAuth, requirePermission('manage_users'), handler);
 * 
 * // Require resource ownership (IDOR prevention)
 * router.get('/users/:id/data', requireAuth, requireOwnership('id'), handler);
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../services/logger.service.js';
import { AzureAdUser } from '../services/auth.service.js';
import { Permission, Role, hasPermission, ADMIN_ROLES } from '../config/rbac.js';

// ============================================================================
// TYPE EXTENSIONS
// ============================================================================

/**
 * Extend Express Session to include application-specific data.
 * This adds type safety for session properties used in authentication.
 */
declare module 'express-session' {
  interface SessionData {
    /** Authenticated user data from Azure AD */
    user?: AzureAdUser & {
      role?: string;
      permissions?: string[];
    };
    /** OAuth state parameter for CSRF protection */
    oauthState?: string | undefined;
    /** Azure AD access token for Graph API calls */
    accessToken?: string | undefined;
    /** Azure AD refresh token for token renewal */
    refreshToken?: string | undefined;
    /** Timestamp when access token expires (Unix ms) */
    tokenExpiresAt?: number | undefined;
    /** Timestamp of last successful authentication (Unix ms) */
    lastAuthAt?: number | undefined;
    /** Timestamp of last re-authentication for sensitive ops (Unix ms) */
    lastReauthAt?: number | undefined;
  }
}

/**
 * Extend Express Request and global namespace for user data.
 * Allows accessing user via req.user with proper typing.
 */
declare global {
  namespace Express {
    /** User interface with Azure AD and RBAC properties */
    interface User extends AzureAdUser {
      role?: string;
      permissions?: string[];
    }

    interface Request {
      /** Authenticated user attached by auth middleware */
      user?: User;
    }
  }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Middleware to require authentication.
 * Returns 401 Unauthorized if no valid session exists.
 * 
 * Use this middleware on routes that require a logged-in user.
 * Attaches user data to req.user for downstream handlers.
 * 
 * @param req - Express request object
 * @param res - Express response object  
 * @param next - Next middleware function
 * 
 * @example
 * router.get('/profile', requireAuth, (req, res) => {
 *   res.json({ user: req.user });
 * });
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Check for valid session with user data
  if (req.session?.user) {
    try {
      // Fetch fresh user data from database to reflect permission changes immediately
      const { userService } = await import('../services/user.service.js');
      const freshUser = await userService.getUserById(req.session.user.id);

      if (!freshUser) {
        // User not found in database (deleted)
        req.session.destroy(() => {
          res.status(401).json({ error: 'Unauthorized', message: 'User no longer exists' });
        });
        return;
      }

      // Update session with fresh data and attach to request
      req.session.user = {
        ...req.session.user,
        role: freshUser.role,
        permissions: freshUser.permissions
      };
      req.user = req.session.user;

      log.debug('User authenticated with fresh permissions', {
        userId: req.user.id,
        email: req.user.email,
        role: freshUser.role
      });
      next();
      return;
    } catch (error) {
      log.error('Failed to refresh user data', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.session.user.id
      });
      // On error, still allow through but log the issue
      req.user = req.session.user;
      next();
      return;
    }
  }

  // No valid session - return 401 Unauthorized
  // Note: Auto dev user was removed to fix logout issues
  // Use POST /api/auth/dev-login endpoint for development testing
  log.debug('Unauthorized request - no session', {
    path: req.path,
    sessionId: req.sessionID?.substring(0, 8)
  });
  res.status(401).json({ error: 'Unauthorized', message: 'Session not found or expired' });
}

// ============================================================================
// RE-AUTHENTICATION MIDDLEWARE (Session Security)
// ============================================================================

/**
 * Default re-authentication window in minutes.
 * Users must have authenticated within this time for sensitive operations.
 */
const DEFAULT_REAUTH_MAX_AGE_MINUTES = 15;

/**
 * Custom error code for re-authentication required.
 * Frontend can detect this and prompt for password/biometric verification.
 */
export const REAUTH_REQUIRED_ERROR = 'REAUTH_REQUIRED';

/**
 * Middleware factory to require recent authentication for sensitive operations.
 * 
 * This prevents session hijacking attacks by requiring users to prove they
 * are still present for high-risk actions like:
 * - Role/permission changes
 * - Account deletion
 * - Bulk file deletions
 * - Security setting modifications
 * 
 * OWASP Session Management Cheat Sheet:
 * "Re-authenticate users before sensitive operations"
 * 
 * @param maxAgeMinutes - Maximum age of authentication in minutes (default: 15)
 * @returns Express middleware function
 * 
 * @example
 * // Require auth within last 15 minutes for role changes
 * router.put('/users/:id/role', requireAuth, requireRecentAuth(15), handler);
 * 
 * // Require very recent auth (5 min) for account deletion
 * router.delete('/users/:id', requireAuth, requireRecentAuth(5), handler);
 */
export function requireRecentAuth(maxAgeMinutes: number = DEFAULT_REAUTH_MAX_AGE_MINUTES) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;

    // Must be authenticated first
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check for recent re-authentication (higher priority)
    const lastReauthAt = req.session.lastReauthAt;
    const lastAuthAt = req.session.lastAuthAt;

    // Use the more recent of lastReauthAt or lastAuthAt
    const lastValidAuth = Math.max(lastReauthAt ?? 0, lastAuthAt ?? 0);

    if (!lastValidAuth) {
      // Session exists but no auth timestamp - require re-auth
      log.warn('Session missing auth timestamp, requiring re-authentication', {
        userId: user.id,
        path: req.path,
        method: req.method,
      });
      res.status(401).json({
        error: REAUTH_REQUIRED_ERROR,
        message: 'Re-authentication required for this operation',
        maxAgeMinutes,
      });
      return;
    }

    const now = Date.now();
    const ageMinutes = (now - lastValidAuth) / (1000 * 60);

    if (ageMinutes > maxAgeMinutes) {
      log.debug('Re-authentication required for sensitive operation', {
        userId: user.id,
        path: req.path,
        method: req.method,
        ageMinutes: Math.round(ageMinutes),
        maxAgeMinutes,
      });
      res.status(401).json({
        error: REAUTH_REQUIRED_ERROR,
        message: 'Re-authentication required for this operation',
        maxAgeMinutes,
        lastAuthAge: Math.round(ageMinutes),
      });
      return;
    }

    // Auth is recent enough, proceed
    log.debug('Recent auth check passed', {
      userId: user.id,
      ageMinutes: Math.round(ageMinutes),
      maxAgeMinutes,
    });
    next();
  };
}

/**
 * Update session with current authentication timestamp.
 * Call this after successful login or re-authentication.
 * 
 * @param req - Express request with session
 * @param isReauth - Whether this is a re-authentication (vs initial login)
 */
export function updateAuthTimestamp(req: Request, isReauth: boolean = false): void {
  const now = Date.now();
  req.session.lastAuthAt = now;
  if (isReauth) {
    req.session.lastReauthAt = now;
  }
}

/**
 * Middleware for optional authentication checking.
 * Attaches user to request if session exists, but doesn't block.
 * 
 * Use this for routes that work both with and without authentication,
 * such as public pages that show personalized content for logged-in users.
 * 
 * @param req - Express request object
 * @param _res - Express response object (unused)
 * @param next - Next middleware function
 * 
 * @example
 * router.get('/home', checkSession, (req, res) => {
 *   if (req.user) {
 *     // Show personalized content
 *   } else {
 *     // Show public content
 *   }
 * });
 */
export function checkSession(req: Request, _res: Response, next: NextFunction): void {
  if (req.session?.user) {
    req.user = req.session.user;
  }
  next();
}

/**
 * Get current authenticated user from request.
 * Utility function for retrieving user data in route handlers.
 * 
 * @param req - Express request object
 * @returns User object if authenticated, undefined otherwise
 * 
 * @example
 * router.get('/data', requireAuth, (req, res) => {
 *   const user = getCurrentUser(req);
 *   // user is guaranteed to exist after requireAuth
 * });
 */
export function getCurrentUser(req: Request): Express.User | undefined {
  // Check session first (primary source)
  if (req.session?.user) {
    return req.session.user;
  }

  // Fall back to req.user (set by middleware)
  return req.user;
}

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Middleware factory for permission-based authorization.
 * Returns 403 Forbidden if user lacks the required permission.
 * 
 * Must be used after requireAuth middleware to ensure user exists.
 * Checks both role-based permissions and explicit user permissions.
 * 
 * @param permission - The permission required to access the route
 * @returns Express middleware function
 * 
 * @example
 * // Require manage_users permission
 * router.get('/users', requireAuth, requirePermission('manage_users'), handler);
 * 
 * // Require storage:write permission
 * router.post('/upload', requireAuth, requirePermission('storage:write'), handler);
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;

    // Check authentication first
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check role-based permission (from RBAC config)
    if (user.role && hasPermission(user.role, permission)) {
      next();
      return;
    }

    // Check explicit permissions array (for custom per-user permissions)
    if (user.permissions && user.permissions.includes(permission)) {
      next();
      return;
    }

    // Permission denied - log and return 403
    log.warn('Access denied: missing permission', {
      userId: user.id,
      role: user.role,
      requiredPermission: permission
    });
    res.status(403).json({ error: 'Access Denied' });
  };
}

/**
 * Middleware factory for role-based authorization.
 * Returns 403 Forbidden if user doesn't have one of the required roles.
 * 
 * Use this when specific role(s) are required, not just permissions.
 * For permission-based checks, prefer requirePermission().
 * 
 * @param roles - The role(s) allowed to access the route (accepts single role or multiple)
 * @returns Express middleware function
 * 
 * @example
 * // Only admins can access this route
 * router.get('/admin-only', requireAuth, requireRole('admin'), handler);
 * 
 * // Admins and managers can access this route
 * router.get('/admin-manager', requireAuth, requireRole('admin', 'manager'), handler);
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;

    // Check authentication first
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if user has any of the allowed roles
    if (user.role && roles.includes(user.role as Role)) {
      next();
      return;
    }

    // Role mismatch - log and return 403
    log.warn('Access denied: incorrect role', {
      userId: user.id,
      userRole: user.role,
      requiredRoles: roles
    });
    res.status(403).json({ error: 'You don\'t have permission to access this resource' });
  };
}

// ============================================================================
// RESOURCE OWNERSHIP MIDDLEWARE (IDOR PREVENTION)
// ============================================================================

/**
 * Middleware factory for resource ownership validation.
 * Prevents Insecure Direct Object Reference (IDOR) attacks (CWE-639).
 * 
 * Validates that the authenticated user owns the resource they're trying
 * to access, OR has an admin role that allows accessing any resource.
 * 
 * OWASP Authorization Cheat Sheet recommendation:
 * "Ensure lookup IDs cannot be tampered with to access unauthorized data."
 * 
 * @param userIdParam - The request parameter name containing the user ID to check
 * @param options - Configuration options
 * @param options.allowAdminBypass - If true, admin roles can access any resource
 * @returns Express middleware function
 * 
 * @example
 * // User can only access their own profile
 * router.get('/users/:userId/profile', requireAuth, requireOwnership('userId'), handler);
 * 
 * // User can only access their own data, but admins can access any
 * router.get('/users/:id/data', requireAuth, requireOwnership('id', { allowAdminBypass: true }), handler);
 */
export function requireOwnership(
  userIdParam: string,
  options: { allowAdminBypass?: boolean } = { allowAdminBypass: true }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;

    // Check authentication first (defense in depth)
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get the resource owner ID from request parameters
    const resourceOwnerId = req.params[userIdParam];

    // Validate that the parameter exists
    if (!resourceOwnerId) {
      log.warn('Ownership check failed: missing parameter', {
        userId: user.id,
        parameter: userIdParam,
        path: req.path,
      });
      res.status(400).json({ error: 'Bad Request: Missing resource identifier' });
      return;
    }

    // Check if user owns the resource
    if (user.id === resourceOwnerId) {
      next();
      return;
    }

    // Check if admin bypass is allowed and user has admin role
    if (options.allowAdminBypass && user.role && ADMIN_ROLES.includes(user.role as Role)) {
      log.debug('Admin bypass for ownership check', {
        adminId: user.id,
        resourceOwnerId,
        path: req.path,
      });
      next();
      return;
    }

    // Access denied - potential IDOR attempt
    log.warn('Access denied: ownership check failed (potential IDOR)', {
      userId: user.id,
      userRole: user.role,
      resourceOwnerId,
      path: req.path,
      method: req.method,
    });
    res.status(403).json({ error: 'Forbidden: You do not have access to this resource' });
  };
}

/**
 * Middleware factory for validating resource ownership with custom ID sources.
 * More flexible than requireOwnership - allows checking against body, query, or custom sources.
 * 
 * @param getOwnerId - Function to extract the resource owner ID from the request
 * @param options - Configuration options
 * @returns Express middleware function
 * 
 * @example
 * // Check ownership from request body
 * router.post('/transfer', requireAuth, requireOwnershipCustom(
 *   (req) => req.body.sourceUserId
 * ), handler);
 */
export function requireOwnershipCustom(
  getOwnerId: (req: Request) => string | undefined,
  options: { allowAdminBypass?: boolean } = { allowAdminBypass: true }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const resourceOwnerId = getOwnerId(req);

    if (!resourceOwnerId) {
      log.warn('Custom ownership check failed: owner ID not found', {
        userId: user.id,
        path: req.path,
      });
      res.status(400).json({ error: 'Bad Request: Missing resource identifier' });
      return;
    }

    // Check ownership
    if (user.id === resourceOwnerId) {
      next();
      return;
    }

    // Check admin bypass
    if (options.allowAdminBypass && user.role && ADMIN_ROLES.includes(user.role as Role)) {
      next();
      return;
    }

    log.warn('Access denied: custom ownership check failed', {
      userId: user.id,
      resourceOwnerId,
      path: req.path,
    });
    res.status(403).json({ error: 'Forbidden: You do not have access to this resource' });
  };
}

// ============================================================================
// AUTHORIZATION ERROR HELPERS
// ============================================================================

/**
 * Standard authorization error response.
 * Ensures consistent, secure error handling across all auth failures.
 * 
 * OWASP: "Exit safely when authorization checks fail"
 * - Returns generic error message to client
 * - Logs detailed information server-side
 * - Does not leak sensitive authorization details
 * 
 * @param res - Express response object
 * @param statusCode - HTTP status code (401 or 403)
 * @param logMessage - Detailed message for server logs
 * @param logDetails - Additional details for logging
 */
export function authorizationError(
  res: Response,
  statusCode: 401 | 403,
  logMessage: string,
  logDetails: Record<string, unknown>
): void {
  log.warn(logMessage, logDetails);

  const message = statusCode === 401
    ? 'Authentication required'
    : 'Access denied';

  res.status(statusCode).json({ error: message });
}
