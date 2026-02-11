/**
 * @fileoverview Unit tests for authentication middleware.
 * 
 * Tests auth, permission, role, and ownership middleware functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requireAuth,
  requirePermission,
  requireRole,
  requireOwnership,
  requireOwnershipCustom,
  requireRecentAuth,
  checkSession,
  getCurrentUser,
  updateAuthTimestamp,
  authorizationError,
  REAUTH_REQUIRED_ERROR,
} from '../../src/shared/middleware/auth.middleware.js';
import { createMockRequest, createMockResponse, createMockNext, createMockUser } from '../setup.js';

describe('Auth Middleware', () => {
  describe('requireAuth', () => {
    it('should call next if session has user', async () => {
      const user = createMockUser();
      const req = createMockRequest({ session: { user } });
      const res = createMockResponse();
      const next = createMockNext();

      // Mock userService.getUserById
      const userServiceMock = {
        getUserById: vi.fn().mockResolvedValue(user)
      };

      // Mock dynamic import
      vi.mock('../../src/modules/users/user.service.js', () => ({
        userService: userServiceMock
      }));

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
    });

    it('should return 401 if no session', () => {
      const req = createMockRequest({ session: {} });
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Unauthorized' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if session is undefined', () => {
      const req = createMockRequest({ session: undefined });
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireRecentAuth', () => {
    it('should call next if auth is recent', () => {
      const user = createMockUser();
      const now = Date.now();
      const req = createMockRequest({
        session: { user, lastAuthAt: now - 5 * 60 * 1000 }, // 5 minutes ago
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRecentAuth(15); // 15 min max
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 401 if auth is too old', () => {
      const user = createMockUser();
      const now = Date.now();
      const req = createMockRequest({
        session: { user, lastAuthAt: now - 20 * 60 * 1000 }, // 20 minutes ago
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRecentAuth(15); // 15 min max
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: REAUTH_REQUIRED_ERROR })
      );
    });

    it('should return 401 if not authenticated', () => {
      const req = createMockRequest({ session: {} });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRecentAuth();
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should require reauth if no timestamp exists', () => {
      const user = createMockUser();
      const req = createMockRequest({
        session: { user, lastAuthAt: undefined },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRecentAuth();
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: REAUTH_REQUIRED_ERROR })
      );
    });

    it('should use lastReauthAt if more recent', () => {
      const user = createMockUser();
      const now = Date.now();
      const req = createMockRequest({
        session: {
          user,
          lastAuthAt: now - 20 * 60 * 1000, // 20 minutes ago
          lastReauthAt: now - 5 * 60 * 1000, // 5 minutes ago
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRecentAuth(15);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('checkSession', () => {
    it('should attach user if session exists', () => {
      const user = createMockUser();
      const req = createMockRequest({ session: { user } });
      const res = createMockResponse();
      const next = createMockNext();

      checkSession(req, res, next);

      expect(req.user).toBe(user);
      expect(next).toHaveBeenCalled();
    });

    it('should call next without attaching user if no session', () => {
      const req = createMockRequest({ session: {} });
      const res = createMockResponse();
      const next = createMockNext();

      checkSession(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should return user from session', () => {
      const user = createMockUser();
      const req = createMockRequest({ session: { user } });

      const result = getCurrentUser(req);

      expect(result).toBe(user);
    });

    it('should return user from req.user if session empty', () => {
      const user = createMockUser();
      const req = createMockRequest({ session: {}, user });

      const result = getCurrentUser(req);

      expect(result).toBe(user);
    });

    it('should return undefined if no user anywhere', () => {
      const req = createMockRequest({ session: {} });

      const result = getCurrentUser(req);

      expect(result).toBeUndefined();
    });
  });

  describe('updateAuthTimestamp', () => {
    it('should set lastAuthAt', () => {
      const req = createMockRequest({ session: {} });
      const before = Date.now();

      updateAuthTimestamp(req);
      const after = Date.now();

      expect(req.session.lastAuthAt).toBeGreaterThanOrEqual(before);
      expect(req.session.lastAuthAt).toBeLessThanOrEqual(after);
    });

    it('should set lastReauthAt when isReauth is true', () => {
      const req = createMockRequest({ session: {} });

      updateAuthTimestamp(req, true);

      expect(req.session.lastReauthAt).toBeDefined();
      expect(req.session.lastAuthAt).toBeDefined();
    });

    it('should not set lastReauthAt when isReauth is false', () => {
      const req = createMockRequest({ session: {} });

      updateAuthTimestamp(req, false);

      expect(req.session.lastReauthAt).toBeUndefined();
      expect(req.session.lastAuthAt).toBeDefined();
    });
  });

  describe('requirePermission', () => {
    it('should call next if user has permission via role', () => {
      const user = createMockUser({ role: 'admin' });
      const req = createMockRequest({ session: { user } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requirePermission('manage_system');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should call next if user has explicit permission', () => {
      const user = createMockUser({ role: 'user', permissions: ['manage_users'] });
      const req = createMockRequest({ session: { user } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requirePermission('manage_users');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 if user lacks permission', () => {
      const user = createMockUser({ role: 'user' });
      const req = createMockRequest({ session: { user } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requirePermission('manage_system');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Access Denied') })
      );
    });

    it('should return 401 if not authenticated', () => {
      const req = createMockRequest({ session: {} });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requirePermission('view_chat');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireRole', () => {
    it('should call next if user has exact role', () => {
      const user = createMockUser({ role: 'admin' });
      const req = createMockRequest({ session: { user } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole('admin');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 if user has different role', () => {
      const user = createMockUser({ role: 'user' });
      const req = createMockRequest({ session: { user } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 401 if not authenticated', () => {
      const req = createMockRequest({ session: {} });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireOwnership', () => {
    it('should call next if user owns the resource', () => {
      const user = createMockUser({ id: 'user-123' });
      const req = createMockRequest({
        session: { user },
        params: { userId: 'user-123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireOwnership('userId');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow admin to access any resource', () => {
      const user = createMockUser({ id: 'admin-id', role: 'admin' });
      const req = createMockRequest({
        session: { user },
        params: { userId: 'other-user-123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireOwnership('userId', { allowAdminBypass: true });
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow manager to access any resource', () => {
      const user = createMockUser({ id: 'manager-id', role: 'leader' }); // Updated role to 'leader' which is a manager equivalent
      const req = createMockRequest({
        session: { user },
        params: { userId: 'other-user-123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireOwnership('userId', { allowAdminBypass: true });
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access if admin bypass is disabled', () => {
      const user = createMockUser({ id: 'admin-id', role: 'admin' });
      const req = createMockRequest({
        session: { user },
        params: { userId: 'other-user-123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireOwnership('userId', { allowAdminBypass: false });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 if regular user tries to access others resource', () => {
      const user = createMockUser({ id: 'user-123', role: 'user' });
      const req = createMockRequest({
        session: { user },
        params: { userId: 'other-user-456' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireOwnership('userId');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Forbidden') })
      );
    });

    it('should return 400 if resource ID param is missing', () => {
      const user = createMockUser();
      const req = createMockRequest({
        session: { user },
        params: {},
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireOwnership('userId');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 if not authenticated', () => {
      const req = createMockRequest({
        session: {},
        params: { userId: 'user-123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireOwnership('userId');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireOwnershipCustom', () => {
    it('allows owner', () => {
      const user = createMockUser({ id: 'owner-id' });
      const req = createMockRequest({ session: { user } });
      req.body = { ownerId: 'owner-id' };
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireOwnershipCustom(r => r.body.ownerId);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('allows admin bypass', () => {
      const user = createMockUser({ id: 'admin-id', role: 'admin' });
      const req = createMockRequest({ session: { user }, body: { ownerId: 'other' } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireOwnershipCustom(r => r.body.ownerId, { allowAdminBypass: true });
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('denies when owner mismatch and no admin bypass', () => {
      const user = createMockUser({ id: 'admin-id', role: 'admin' });
      const req = createMockRequest({ session: { user }, body: { ownerId: 'other' } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireOwnershipCustom(r => r.body.ownerId, { allowAdminBypass: false });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 when identifier missing', () => {
      const user = createMockUser({ id: 'owner-id' });
      const req = createMockRequest({ session: { user }, body: {} });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireOwnershipCustom(r => r.body.ownerId);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 401 when unauthenticated', () => {
      const req = createMockRequest({ session: {}, body: { ownerId: 'x' } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireOwnershipCustom(r => r.body.ownerId);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('authorizationError', () => {
    it('should return 401 for authentication errors', () => {
      const res = createMockResponse();

      authorizationError(res, 401, 'Test log message', { userId: 'test' });

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should return 403 for authorization errors', () => {
      const res = createMockResponse();

      authorizationError(res, 403, 'Access denied', { resource: 'test' });

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
    });
  });
});
