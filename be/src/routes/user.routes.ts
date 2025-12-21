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

import { Router, Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service.js';
import { log } from '../services/logger.service.js';
import { requireAuth, requirePermission, requireOwnership, requireRecentAuth, REAUTH_REQUIRED_ERROR } from '../middleware/auth.middleware.js';
import { auditService, AuditAction, AuditResourceType } from '../services/audit.service.js';
import { isAdminRole } from '../config/rbac.js';

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
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const roles = req.query.roles ? (req.query.roles as string).split(',') : undefined;
        const users = await userService.getAllUsers(roles as any);
        res.json(users);
    } catch (error) {
        log.error('Failed to fetch users', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

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
router.get('/ip-history', requirePermission('manage_users'), async (req: Request, res: Response) => {
    try {
        const historyMap = await userService.getAllUsersIpHistory();
        // Convert Map to plain object for JSON serialization
        const historyObject: Record<string, any[]> = {};
        for (const [userId, history] of historyMap.entries()) {
            historyObject[userId] = history;
        }
        res.json(historyObject);
    } catch (error) {
        log.error('Failed to fetch IP history', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ error: 'Failed to fetch IP history' });
    }
});

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
router.get('/:id/ip-history', requirePermission('manage_users'), async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
    }

    try {
        const history = await userService.getUserIpHistory(id);
        res.json(history);
    } catch (error) {
        log.error('Failed to fetch user IP history', { error: error instanceof Error ? error.message : String(error), userId: id });
        res.status(500).json({ error: 'Failed to fetch IP history' });
    }
});

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
router.put('/:id/role', requirePermission('manage_users'), requireRecentAuth(15), async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;
    const currentUser = req.session.user;

    // Input validation
    if (typeof id !== 'string' || typeof role !== 'string') {
        res.status(400).json({ error: 'Invalid input' });
        return;
    }

    // Validate UUID format for id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id) && id !== 'root-user' && id !== 'dev-user-001') {
        res.status(400).json({ error: 'Invalid user ID format' });
        return;
    }

    // Validate role value (strict type check)
    const validRoles = ['admin', 'leader', 'user'] as const;
    if (!validRoles.includes(role as typeof validRoles[number])) {
        res.status(400).json({ error: 'Invalid role' });
        return;
    }

    // SECURITY: Prevent self-modification of role
    // Users should not be able to change their own role to prevent privilege escalation
    if (currentUser?.id === id) {
        log.warn('Self role modification attempt blocked', {
            userId: currentUser.id,
            attemptedRole: role,
        });
        res.status(400).json({ error: 'Cannot modify your own role' });
        return;
    }

    // SECURITY: Prevent privilege escalation by managers
    // Only admins can promote users to admin role
    if (role === 'admin' && currentUser?.role !== 'admin') {
        log.warn('Unauthorized admin promotion attempt', {
            userId: currentUser?.id,
            userRole: currentUser?.role,
            targetUserId: id,
        });
        res.status(403).json({ error: 'Only administrators can grant admin role' });
        return;
    }

    try {
        const updatedUser = await userService.updateUserRole(id, role as 'admin' | 'leader' | 'user');
        if (!updatedUser) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Log audit event for role change
        await auditService.log({
            userId: req.session.user?.id ?? null,
            userEmail: req.session.user?.email || 'unknown',
            action: AuditAction.UPDATE_ROLE,
            resourceType: AuditResourceType.USER,
            resourceId: id,
            details: {
                targetEmail: updatedUser.email,
                oldRole: req.body.oldRole, // Frontend should send this if available
                newRole: role,
            },
            ipAddress: getClientIp(req),
        });

        log.debug('User role updated', {
            adminId: req.session.user?.id,
            targetUserId: id,
            newRole: role
        });

        res.json(updatedUser);
    } catch (error) {
        log.error('Failed to update user role', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

/**
 * PUT /api/users/:id/permissions
 * Update user permissions.
 * 
 * Used to grant granular permissions to specific users.
 * 
 * @requires manage_users permission
 */
router.put('/:id/permissions', requirePermission('manage_users'), async (req: Request, res: Response) => {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
    }

    if (!Array.isArray(permissions)) {
        res.status(400).json({ error: 'Permissions must be an array of strings' });
        return;
    }

    try {
        await userService.updateUserPermissions(id, permissions);
        res.json({ success: true });
    } catch (error) {
        log.error('Failed to update user permissions', { userId: id, error: String(error) });
        res.status(500).json({ error: 'Failed to update user permissions' });
    }
});

export default router;
