
import { Request, Response, NextFunction } from 'express';
import { log } from '@/services/logger.service.js';
import { User } from '@/models/types.js';
import { hasPermission, Role, Permission, ADMIN_ROLES } from '@/config/rbac.js';

export const REAUTH_REQUIRED_ERROR = 'REAUTH_REQUIRED';

/**
 * Updates the authentication timestamp in the session.
 *
 * @param req - The Express request object.
 * @param isReauth - Whether this is a re-authentication event.
 */
export function updateAuthTimestamp(req: Request, isReauth: boolean = false): void {
  if (req.session) {
    req.session.lastAuthAt = Date.now();
    if (isReauth) {
      req.session.lastReauthAt = Date.now();
    }
  }
}

/**
 * Middleware to require authentication.
 * Checks if a user is present in the session.
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.user) {
    req.user = req.session.user;
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Middleware to require recent authentication (e.g., for sensitive actions).
 *
 * @param maxAgeMinutes - The maximum age of the authentication session in minutes (default: 15).
 * @returns An Express middleware function.
 */
export function requireRecentAuth(maxAgeMinutes: number = 15) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const lastAuth = req.session.lastReauthAt || req.session.lastAuthAt;
    if (!lastAuth) {
      res.status(401).json({
        error: REAUTH_REQUIRED_ERROR,
        message: 'Re-authentication required'
      });
      return;
    }

    const ageMinutes = (Date.now() - lastAuth) / (1000 * 60);
    if (ageMinutes > maxAgeMinutes) {
      res.status(401).json({
        error: REAUTH_REQUIRED_ERROR,
        message: `Authentication too old (max ${maxAgeMinutes}m). Please re-authenticate.`
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check for an active session and populate `req.user`.
 * Does not block if unauthenticated.
 *
 * @param req - The Express request object.
 * @param _res - The Express response object.
 * @param next - The next middleware function.
 */
export function checkSession(req: Request, _res: Response, next: NextFunction): void {
  if (req.session?.user) {
    req.user = req.session.user;
  }
  next();
}

/**
 * Retrieves the current user from the request or session.
 *
 * @param req - The Express request object.
 * @returns The current user or undefined.
 */
export function getCurrentUser(req: Request): User | undefined {
  if (req.session?.user) {
    return req.session.user;
  }
  return req.user;
}

/**
 * Middleware to require a specific permission.
 *
 * @param permission - The required permission string.
 * @returns An Express middleware function.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!req.user) {
      req.user = user;
    }

    if (user.role && hasPermission(user.role, permission)) {
      next();
      return;
    }

    if (user.permissions) {
      let perms: string[] = [];
      if (typeof user.permissions === 'string') {
        try {
          perms = JSON.parse(user.permissions);
        } catch { perms = []; }
      } else if (Array.isArray(user.permissions)) {
        perms = user.permissions;
      }

      if (perms.includes(permission)) {
        next();
        return;
      }
    }

    log.warn('Access denied: missing permission', {
      userId: user.id,
      role: user.role,
      requiredPermission: permission
    });
    res.status(403).json({ error: 'Access Denied' });
  };
}

/**
 * Middleware to require one of the specified roles.
 *
 * @param roles - A list of allowed roles.
 * @returns An Express middleware function.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!req.user) {
      req.user = user;
    }

    if (user.role && roles.includes(user.role as Role)) {
      next();
      return;
    }

    log.warn('Access denied: incorrect role', {
      userId: user.id,
      userRole: user.role,
      requiredRoles: roles
    });
    res.status(403).json({ error: 'You don\'t have permission to access this resource' });
  };
}

/**
 * Middleware to require resource ownership based on a user ID parameter.
 *
 * @param userIdParam - The name of the route parameter containing the owner's user ID.
 * @param options - Options (e.g., allow admins to bypass ownership check).
 * @returns An Express middleware function.
 */
export function requireOwnership(
  userIdParam: string,
  options: { allowAdminBypass?: boolean } = { allowAdminBypass: true }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!req.user) {
      req.user = user;
    }

    const resourceOwnerId = req.params[userIdParam];

    if (!resourceOwnerId) {
      res.status(400).json({ error: 'Bad Request: Missing resource identifier' });
      return;
    }

    if (user.id === resourceOwnerId) {
      next();
      return;
    }

    if (options.allowAdminBypass && user.role && ADMIN_ROLES.includes(user.role as Role)) {
      next();
      return;
    }

    res.status(403).json({ error: 'Forbidden: You do not have access to this resource' });
  };
}

/**
 * Middleware to require resource ownership based on a custom ID resolver.
 *
 * @param getOwnerId - A function to extract the owner's ID from the request.
 * @param options - Options (e.g., allow admins to bypass ownership check).
 * @returns An Express middleware function.
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

    if (!req.user) {
      req.user = user;
    }

    const resourceOwnerId = getOwnerId(req);

    if (!resourceOwnerId) {
      res.status(400).json({ error: 'Bad Request: Missing resource identifier' });
      return;
    }

    if (user.id === resourceOwnerId) {
      next();
      return;
    }

    if (options.allowAdminBypass && user.role && ADMIN_ROLES.includes(user.role as Role)) {
      next();
      return;
    }

    res.status(403).json({ error: 'Forbidden: You do not have access to this resource' });
  };
}

/**
 * Helper to handle authorization errors and log them.
 *
 * @param res - The Express response object.
 * @param statusCode - The HTTP status code (401 or 403).
 * @param logMessage - The message to log.
 * @param logDetails - The details to log.
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
