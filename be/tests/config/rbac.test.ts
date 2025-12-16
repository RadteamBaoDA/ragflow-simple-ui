/**
 * @fileoverview Unit tests for RBAC configuration.
 * 
 * Tests role-based access control functions and permission mappings.
 */

import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  isAdminRole,
  DEFAULT_ROLE,
  ADMIN_ROLES,
  ROLE_PERMISSIONS,
  type Role,
  type Permission,
} from '../../src/config/rbac.js';

describe('RBAC Configuration', () => {
  describe('DEFAULT_ROLE', () => {
    it('should be "user"', () => {
      expect(DEFAULT_ROLE).toBe('user');
    });
  });

  describe('ADMIN_ROLES', () => {
    it('should include "admin" and "manager"', () => {
      expect(ADMIN_ROLES).toContain('admin');
      expect(ADMIN_ROLES).toContain('manager');
    });

    it('should not include "user"', () => {
      expect(ADMIN_ROLES).not.toContain('user');
    });

    it('should be readonly', () => {
      expect(ADMIN_ROLES).toHaveLength(2);
    });
  });

  describe('ROLE_PERMISSIONS', () => {
    it('admin should have all permissions', () => {
      const adminPermissions = ROLE_PERMISSIONS.admin;
      expect(adminPermissions).toContain('view_chat');
      expect(adminPermissions).toContain('view_search');
      expect(adminPermissions).toContain('view_history');
      expect(adminPermissions).toContain('manage_users');
      expect(adminPermissions).toContain('manage_system');
      expect(adminPermissions).toContain('view_analytics');
      expect(adminPermissions).toContain('storage:read');
      expect(adminPermissions).toContain('storage:write');
      expect(adminPermissions).toContain('storage:delete');
    });

    it('manager should have user management but not system management', () => {
      const managerPermissions = ROLE_PERMISSIONS.manager;
      expect(managerPermissions).toContain('manage_users');
      expect(managerPermissions).not.toContain('manage_system');
      expect(managerPermissions).toContain('view_analytics');
      expect(managerPermissions).toContain('storage:read');
      expect(managerPermissions).toContain('storage:write');
      expect(managerPermissions).toContain('storage:delete');
    });

    it('user should have basic permissions only', () => {
      const userPermissions = ROLE_PERMISSIONS.user;
      expect(userPermissions).toContain('view_chat');
      expect(userPermissions).toContain('view_search');
      expect(userPermissions).toContain('view_history');
      expect(userPermissions).toContain('storage:read');
      expect(userPermissions).not.toContain('manage_users');
      expect(userPermissions).not.toContain('manage_system');
      expect(userPermissions).not.toContain('view_analytics');
      expect(userPermissions).not.toContain('storage:write');
      expect(userPermissions).not.toContain('storage:delete');
    });
  });

  describe('isAdminRole', () => {
    it('should return true for admin', () => {
      expect(isAdminRole('admin')).toBe(true);
    });

    it('should return true for manager', () => {
      expect(isAdminRole('manager')).toBe(true);
    });

    it('should return false for user', () => {
      expect(isAdminRole('user')).toBe(false);
    });

    it('should return false for unknown role', () => {
      expect(isAdminRole('unknown')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isAdminRole('')).toBe(false);
    });
  });

  describe('hasPermission', () => {
    describe('admin role', () => {
      it('should have view_chat permission', () => {
        expect(hasPermission('admin', 'view_chat')).toBe(true);
      });

      it('should have manage_system permission', () => {
        expect(hasPermission('admin', 'manage_system')).toBe(true);
      });

      it('should have manage_users permission', () => {
        expect(hasPermission('admin', 'manage_users')).toBe(true);
      });

      it('should have all storage permissions', () => {
        expect(hasPermission('admin', 'storage:read')).toBe(true);
        expect(hasPermission('admin', 'storage:write')).toBe(true);
        expect(hasPermission('admin', 'storage:delete')).toBe(true);
      });
    });

    describe('manager role', () => {
      it('should have view_chat permission', () => {
        expect(hasPermission('manager', 'view_chat')).toBe(true);
      });

      it('should NOT have manage_system permission', () => {
        expect(hasPermission('manager', 'manage_system')).toBe(false);
      });

      it('should have manage_users permission', () => {
        expect(hasPermission('manager', 'manage_users')).toBe(true);
      });

      it('should have all storage permissions', () => {
        expect(hasPermission('manager', 'storage:read')).toBe(true);
        expect(hasPermission('manager', 'storage:write')).toBe(true);
        expect(hasPermission('manager', 'storage:delete')).toBe(true);
      });
    });

    describe('user role', () => {
      it('should have view_chat permission', () => {
        expect(hasPermission('user', 'view_chat')).toBe(true);
      });

      it('should have view_search permission', () => {
        expect(hasPermission('user', 'view_search')).toBe(true);
      });

      it('should have view_history permission', () => {
        expect(hasPermission('user', 'view_history')).toBe(true);
      });

      it('should have storage:read permission', () => {
        expect(hasPermission('user', 'storage:read')).toBe(true);
      });

      it('should NOT have manage_users permission', () => {
        expect(hasPermission('user', 'manage_users')).toBe(false);
      });

      it('should NOT have manage_system permission', () => {
        expect(hasPermission('user', 'manage_system')).toBe(false);
      });

      it('should NOT have storage:write permission', () => {
        expect(hasPermission('user', 'storage:write')).toBe(false);
      });

      it('should NOT have storage:delete permission', () => {
        expect(hasPermission('user', 'storage:delete')).toBe(false);
      });
    });

    describe('unknown role', () => {
      it('should return false for any permission', () => {
        expect(hasPermission('unknown', 'view_chat')).toBe(false);
        expect(hasPermission('unknown', 'manage_system')).toBe(false);
      });
    });

    describe('empty role', () => {
      it('should return false for any permission', () => {
        expect(hasPermission('', 'view_chat')).toBe(false);
      });
    });
  });
});
