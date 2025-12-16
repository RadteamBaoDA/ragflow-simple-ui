/**
 * @fileoverview Role-Based Access Control (RBAC) configuration.
 * 
 * This module defines the authorization system for the Knowledge Base application.
 * It implements a role-permission model where:
 * - Users are assigned one role (admin, manager, or user)
 * - Each role has a predefined set of permissions
 * - Permissions control access to specific features/actions
 * 
 * @module config/rbac
 * @example
 * import { hasPermission, Role, Permission } from './config/rbac.js';
 * 
 * // Check if user can manage other users
 * if (hasPermission('manager', 'manage_users')) {
 *   // Allow user management
 * }
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Available user roles in the system.
 * Roles are hierarchical in terms of permissions:
 * - admin: Full system access
 * - manager: User management and content access
 * - user: Basic content access only
 */
export type Role = 'admin' | 'manager' | 'user';

/**
 * Available permissions that can be assigned to roles.
 * 
 * Permissions:
 * - view_chat: Access to AI Chat feature
 * - view_search: Access to AI Search feature
 * - view_history: Access to chat history
 * - manage_users: Ability to view and edit user accounts
 * - manage_system: Access to system configuration and tools
 * - view_analytics: Access to usage analytics and reports
 * - storage:read: Ability to read/download files from MinIO storage
 * - storage:write: Ability to upload files to MinIO storage
 * - storage:delete: Ability to delete files from MinIO storage
 */
export type Permission =
    | 'view_chat'
    | 'view_search'
    | 'view_history'
    | 'manage_users'
    | 'manage_system'
    | 'view_analytics'
    | 'storage:read'
    | 'storage:write'
    | 'storage:delete';

// ============================================================================
// ROLE CONFIGURATION
// ============================================================================

/**
 * Default role assigned to new users.
 * New users from Azure AD get this role until an admin upgrades them.
 */
export const DEFAULT_ROLE: Role = 'user';

/**
 * Roles that have administrative privileges.
 * These roles can bypass certain ownership checks (IDOR prevention).
 * Used in authorization middleware for resource access decisions.
 */
export const ADMIN_ROLES: readonly Role[] = ['admin', 'manager'] as const;

/**
 * Check if a role has administrative privileges.
 * 
 * @param role - The role to check
 * @returns True if the role is an admin role
 */
export function isAdminRole(role: string): boolean {
    return ADMIN_ROLES.includes(role as Role);
}

/**
 * Permission mappings for each role.
 * Defines which permissions are granted to each role.
 * 
 * Role capabilities:
 * - admin: All permissions including system management
 * - manager: User management and content access (no system config)
 * - user: Basic content viewing only
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    /** Admin has full system access */
    admin: [
        'view_chat',
        'view_search',
        'view_history',
        'manage_users',
        'manage_system',
        'view_analytics',
        'storage:read',
        'storage:write',
        'storage:delete',
    ],
    /** Manager can manage users and access content */
    manager: [
        'view_chat',
        'view_search',
        'view_history',
        'manage_users', // Managers can view/edit users but maybe restricted (logic in service)
        'view_analytics',
        'storage:read',
        'storage:write',
        'storage:delete',
    ],
    /** Regular user has basic content access */
    user: [
        'view_chat',
        'view_search',
        'view_history',
        'storage:read',
    ],
};

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

/**
 * Checks if a given role has a specific permission.
 * 
 * @param userRole - The role to check (as string for flexibility)
 * @param permission - The permission to verify
 * @returns True if the role has the permission, false otherwise
 * 
 * @example
 * // Check if admin can manage users
 * hasPermission('admin', 'manage_users'); // true
 * 
 * // Check if regular user can manage system
 * hasPermission('user', 'manage_system'); // false
 */
export const hasPermission = (userRole: string, permission: Permission): boolean => {
    const role = userRole as Role;
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
};
