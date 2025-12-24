
import { Request, Response, NextFunction } from 'express';
import { log } from '@/services/logger.service.js';
import { User } from '@/models/types.js';

export type Role = 'admin' | 'leader' | 'user';
export type Permission = string;
export const ADMIN_ROLES: Role[] = ['admin'];
export const REAUTH_REQUIRED_ERROR = 'REAUTH_REQUIRED';

export function hasPermission(role: string, permission: Permission): boolean {
  if (role === 'admin') return true;
  if (role === 'leader' && (permission.startsWith('view_') || permission === 'manage_users')) return true;
  if (role === 'user' && permission.startsWith('view_')) return true;
  return false;
}

export function updateAuthTimestamp(req: Request, isReauth: boolean = false): void {
  if (req.session) {
    req.session.lastAuthAt = Date.now();
    if (isReauth) {
      req.session.lastReauthAt = Date.now();
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.user) {
    req.user = req.session.user;
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

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

export function checkSession(req: Request, _res: Response, next: NextFunction): void {
  if (req.session?.user) {
    req.user = req.session.user;
  }
  next();
}

export function getCurrentUser(req: Request): User | undefined {
  if (req.session?.user) {
    return req.session.user;
  }
  return req.user;
}

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
