
import { Request, Response, NextFunction } from 'express'
import { log } from '@/shared/services/logger.service.js'
import { User } from '@/shared/models/types.js'
import { hasPermission, Role, Permission, ADMIN_ROLES } from '@/shared/config/rbac.js'

/** Session error code used by frontend to trigger re-auth flows */
export const REAUTH_REQUIRED_ERROR = 'REAUTH_REQUIRED'

/**
 * Refreshes session timestamps whenever a user authenticates or reauthenticates.
 * Downstream middleware uses these timestamps to enforce recent-auth checks.
 * @param req - Express request object with session
 * @param isReauth - If true, updates both lastAuthAt and lastReauthAt timestamps
 */
export function updateAuthTimestamp(req: Request, isReauth: boolean = false): void {
  // Only update timestamps if session exists
  if (req.session) {
    // Always update last authentication time
    req.session.lastAuthAt = Date.now()

    // If this is a re-authentication, also update reauth timestamp
    if (isReauth) {
      req.session.lastReauthAt = Date.now()
    }
  }
}

/**
 * Middleware that requires a valid user session to proceed.
 * Attaches user to request object if authenticated.
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Check if session contains authenticated user
  if (req.session?.user) {
    // Attach user to request for downstream handlers
    req.user = req.session.user
    next()
  } else {
    // No valid session - return 401 Unauthorized
    res.status(401).json({ error: 'Unauthorized' })
  }
}

/**
 * Middleware factory that requires authentication within a time window.
 * Returns REAUTH_REQUIRED error if auth is too old, prompting frontend re-auth flow.
 * @param maxAgeMinutes - Maximum age in minutes for valid auth (default: 15)
 * @returns Express middleware function
 */
export function requireRecentAuth(maxAgeMinutes: number = 15) {
  return (req: Request, res: Response, next: NextFunction) => {
    // First check if user is authenticated at all
    if (!req.session?.user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    // Get most recent auth timestamp (prefer reauth over initial auth)
    const lastAuth = req.session.lastReauthAt || req.session.lastAuthAt

    // If no auth timestamp exists, require re-authentication
    if (!lastAuth) {
      res.status(401).json({
        error: REAUTH_REQUIRED_ERROR,
        message: 'Re-authentication required'
      })
      return
    }

    // Calculate how old the authentication is in minutes
    const ageMinutes = (Date.now() - lastAuth) / (1000 * 60)

    // If auth is older than allowed window, require re-authentication
    if (ageMinutes > maxAgeMinutes) {
      res.status(401).json({
        error: REAUTH_REQUIRED_ERROR,
        message: `Authentication too old (max ${maxAgeMinutes}m). Please re-authenticate.`
      })
      return
    }

    // Auth is fresh enough - proceed
    next()
  }
}

/**
 * Middleware that optionally attaches session user to request.
 * Does not enforce authentication - allows requests to proceed regardless.
 * @param req - Express request object
 * @param _res - Express response object (unused)
 * @param next - Next middleware function
 */
export function checkSession(req: Request, _res: Response, next: NextFunction): void {
  // If session has user, attach to request for convenience
  if (req.session?.user) {
    req.user = req.session.user
  }
  // Always proceed regardless of auth status
  next()
}

/**
 * Utility function to get current authenticated user from request.
 * Checks session first, falls back to request.user.
 * @param req - Express request object
 * @returns User object if authenticated, undefined otherwise
 */
export function getCurrentUser(req: Request): User | undefined {
  // Prefer session user (source of truth)
  if (req.session?.user) {
    return req.session.user
  }
  // Fall back to request user (may be set by other middleware)
  return req.user
}

/**
 * Middleware factory that requires a specific permission to access route.
 * Checks both role-based permissions and explicit user permissions.
 * @param permission - The permission required to access the route
 * @returns Express middleware function
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get user from session
    const user = req.session?.user

    // No user - return 401 Unauthorized
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    // Ensure user is attached to request for downstream use
    if (!req.user) {
      req.user = user
    }

    // Check if user's role grants the required permission
    if (user.role && hasPermission(user.role, permission)) {
      next()
      return
    }

    // Check explicit user permissions (may be string or array)
    if (user.permissions) {
      let perms: string[] = []

      // Parse permissions if stored as JSON string
      if (typeof user.permissions === 'string') {
        try {
          perms = JSON.parse(user.permissions)
        } catch { perms = [] }
      } else if (Array.isArray(user.permissions)) {
        perms = user.permissions
      }

      // Check if user has the required permission explicitly
      if (perms.includes(permission)) {
        next()
        return
      }
    }

    // Permission not found - log and return 403 Forbidden
    log.warn('Access denied: missing permission', {
      userId: user.id,
      role: user.role,
      requiredPermission: permission
    })
    res.status(403).json({ error: 'Access Denied' })
  }
}

/**
 * Middleware factory that requires one of the specified roles to access route.
 * @param roles - Allowed roles (variadic parameter)
 * @returns Express middleware function
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get user from session
    const user = req.session?.user

    // No user - return 401 Unauthorized
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    // Ensure user is attached to request for downstream use
    if (!req.user) {
      req.user = user
    }

    // Check if user's role is in the allowed roles list
    if (user.role && roles.includes(user.role as Role)) {
      next()
      return
    }

    // Role not allowed - log and return 403 Forbidden
    log.warn('Access denied: incorrect role', {
      userId: user.id,
      userRole: user.role,
      requiredRoles: roles
    })
    res.status(403).json({ error: 'You don\'t have permission to access this resource' })
  }
}

/**
 * Middleware factory that requires the authenticated user to own the resource.
 * Ownership is determined by matching user ID with a URL parameter.
 * @param userIdParam - Name of the URL parameter containing the owner's user ID
 * @param options - Configuration options
 * @param options.allowAdminBypass - If true, admin roles bypass ownership check (default: true)
 * @returns Express middleware function
 */
export function requireOwnership(
  userIdParam: string,
  options: { allowAdminBypass?: boolean } = { allowAdminBypass: true }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get user from session
    const user = req.session?.user

    // No user - return 401 Unauthorized
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    // Ensure user is attached to request for downstream use
    if (!req.user) {
      req.user = user
    }

    // Extract resource owner ID from URL parameter
    const resourceOwnerId = req.params[userIdParam]

    // Parameter missing - return 400 Bad Request
    if (!resourceOwnerId) {
      res.status(400).json({ error: 'Bad Request: Missing resource identifier' })
      return
    }

    // Check if current user is the resource owner
    if (user.id === resourceOwnerId) {
      next()
      return
    }

    // Check if admin bypass is enabled and user is admin
    if (options.allowAdminBypass && user.role && ADMIN_ROLES.includes(user.role as Role)) {
      next()
      return
    }

    // Not owner and not admin - return 403 Forbidden
    res.status(403).json({ error: 'Forbidden: You do not have access to this resource' })
  }
}

/**
 * Middleware factory with custom ownership resolution logic.
 * Allows flexible ownership checks using a custom getter function.
 * @param getOwnerId - Function to extract owner ID from request
 * @param options - Configuration options
 * @param options.allowAdminBypass - If true, admin roles bypass ownership check (default: true)
 * @returns Express middleware function
 */
export function requireOwnershipCustom(
  getOwnerId: (req: Request) => string | undefined,
  options: { allowAdminBypass?: boolean } = { allowAdminBypass: true }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get user from session
    const user = req.session?.user

    // No user - return 401 Unauthorized
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    // Ensure user is attached to request for downstream use
    if (!req.user) {
      req.user = user
    }

    // Use custom function to extract resource owner ID
    const resourceOwnerId = getOwnerId(req)

    // Owner ID not found - return 400 Bad Request
    if (!resourceOwnerId) {
      res.status(400).json({ error: 'Bad Request: Missing resource identifier' })
      return
    }

    // Check if current user is the resource owner
    if (user.id === resourceOwnerId) {
      next()
      return
    }

    // Check if admin bypass is enabled and user is admin
    if (options.allowAdminBypass && user.role && ADMIN_ROLES.includes(user.role as Role)) {
      next()
      return
    }

    // Not owner and not admin - return 403 Forbidden
    res.status(403).json({ error: 'Forbidden: You do not have access to this resource' })
  }
}

/**
 * Centralized helper for authorization errors.
 * Logs warning and sends consistent JSON error response.
 * @param res - Express response object
 * @param statusCode - HTTP status code (401 or 403)
 * @param logMessage - Message to log
 * @param logDetails - Additional details for logging
 */
export function authorizationError(
  res: Response,
  statusCode: 401 | 403,
  logMessage: string,
  logDetails: Record<string, unknown>
): void {
  // Log the authorization failure with details
  log.warn(logMessage, logDetails)

  // Determine user-facing message based on status code
  const message = statusCode === 401
    ? 'Authentication required'
    : 'Access denied'

  // Send consistent error response
  res.status(statusCode).json({ error: message })
}
