/**
 * @fileoverview User management routes.
 * 
 * This module provides API endpoints for managing users in the system.
 * All routes require 'manage_users' permission (admin/manager roles).
 * 
 * Security: Implements OWASP Authorization Cheat Sheet:
 * - Deny by default (middleware chain)
 * - Role and permission-based access control
 * - Input validation with UUID format checking
 * - Audit logging for all sensitive operations
 * - IDOR prevention for user-specific endpoints
 * 
 * Features:
 * - List all users
 * - Update user roles
 * 
 * @module routes/user
 */

import { Router } from 'express';
import { UserController } from '@/controllers/user.controller.js';
import { requireAuth, requirePermission, requireRecentAuth } from '@/middleware/auth.middleware.js';

const router = Router();
const controller = new UserController();

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/users
 * List all users in the system.
 * 
 * Returns user records from the database with role information.
 * Sensitive fields like access tokens are not included.
 * 
 * @requires manage_users permission
 * @returns {Array<User>} List of all users
 * @returns {500} If database query fails
 */
router.get('/', requireAuth, controller.getUsers.bind(controller));

/**
 * GET /api/users/ip-history
 * Get IP access history for all users.
 * 
 * Returns a mapping of user IDs to their IP history records.
 * Each record contains the IP address and last access timestamp.
 * 
 * @requires manage_users permission
 * @returns {Object} Map of user ID to IP history array
 * @returns {500} If database query fails
 */
router.get('/ip-history', requirePermission('manage_users'), controller.getAllIpHistory.bind(controller));

/**
 * GET /api/users/:id/ip-history
 * Get IP access history for a specific user.
 * 
 * Returns all IPs that have accessed the system as this user,
 * sorted by last access time (most recent first).
 * 
 * @requires manage_users permission
 * @param {string} id - User ID (UUID)
 * @returns {Array<UserIpHistory>} IP history records
 * @returns {500} If database query fails
 */
router.get('/:id/ip-history', requirePermission('manage_users'), controller.getUserIpHistory.bind(controller));

/**
 * PUT /api/users/:id/role
 * Update a user's role.
 * 
 * Changes the role of the specified user. Valid roles are:
 * - 'admin': Full system access
 * - 'manager': Can manage users and storage
 * - 'user': Basic access only
 * 
 * Security checks:
 * - Requires manage_users permission
 * - Requires recent authentication (within 15 minutes) - session security
 * - Prevents self-demotion (users cannot change their own role)
 * - Managers cannot promote users to admin role
 * - Validates input (UUID format, valid role values)
 * - Full audit logging
 * 
 * @requires manage_users permission
 * @requires Recent authentication (OWASP Session Security)
 * @param {string} id - User ID (UUID)
 * @body {string} role - New role ('admin' | 'manager' | 'user')
 * @returns {User} Updated user object
 * @returns {400} If role is invalid or self-modification attempted
 * @returns {401} If re-authentication required (REAUTH_REQUIRED error code)
 * @returns {403} If attempting unauthorized role promotion
 * @returns {404} If user not found
 * @returns {500} If update fails
 */
router.put('/:id/role', requirePermission('manage_users'), requireRecentAuth(15), controller.updateUserRole.bind(controller));

/**
 * PUT /api/users/:id/permissions
 * Update user permissions.
 * 
 * Used to grant granular permissions to specific users.
 * 
 * @requires manage_users permission
 */
router.put('/:id/permissions', requirePermission('manage_users'), controller.updateUserPermissions.bind(controller));

export default router;
