/**
 * @fileoverview User management service.
 * 
 * This module handles user-related database operations:
 * - Creating users from Azure AD profiles (first login)
 * - Syncing user data on subsequent logins
 * - Role and permission management for RBAC
 * - Root user initialization for first-time setup
 * 
 * User Flow:
 * 1. User authenticates via Azure AD
 * 2. findOrCreateUser() checks if user exists in DB
 * 3. If exists: Update profile from Azure AD, return with DB role
 * 4. If new: Create user with default 'user' role
 * 5. User role can be upgraded by admin via updateUserRole()
 * 
 * @module services/user
 */

import { query, queryOne } from '../db/index.js';
import { config } from '../config/index.js';
import { log } from './logger.service.js';
import { AzureAdUser } from './auth.service.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * User record from the database.
 * Combines Azure AD profile data with application-specific RBAC fields.
 */
export interface User {
    /** Unique user ID (from Azure AD object ID) */
    id: string;
    /** User's email address */
    email: string;
    /** User's display name */
    display_name: string;
    /** User's role for RBAC (admin/leader/user) */
    role: 'admin' | 'leader' | 'user';
    /** Additional permissions (JSON string in DB) */
    permissions: string[];
    /** User's organizational department (from Azure AD) */
    department?: string | null;
    /** User's job title (from Azure AD) */
    job_title?: string | null;
    /** User's mobile phone number (from Azure AD) */
    mobile_phone?: string | null;
    /** Account creation timestamp */
    created_at: string;
    /** Last update timestamp */
    updated_at: string;
}

/**
 * User IP history record from the database.
 * Tracks unique IPs per user with last access timestamp.
 */
export interface UserIpHistory {
    /** Auto-increment primary key */
    id: number;
    /** Reference to user ID */
    user_id: string;
    /** Client IP address */
    ip_address: string;
    /** Timestamp of last access from this IP */
    last_accessed_at: string;
}

// ============================================================================
// USER SERVICE CLASS
// ============================================================================

/**
 * Service for user management operations.
 * Handles user CRUD and role/permission management.
 */
export class UserService {
    /**
     * Initialize the root administrator user.
     * Called on startup when the database is empty.
     * 
     * Uses KB_ROOT_USER and KB_ROOT_PASSWORD environment variables
     * to configure the initial admin account.
     * 
     * This ensures there's always at least one admin user who can
     * grant roles to other users.
     */
    async initializeRootUser(): Promise<void> {
        try {
            // Check if any users exist in the database
            const existingUsers = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');

            if (existingUsers && Number(existingUsers.count) > 0) {
                log.debug('Users exist, skipping root user initialization');
                return;
            }

            // Get root user credentials from environment
            const rootUserEmail = process.env['KB_ROOT_USER'] || 'admin@localhost';
            // Note: Password auth not fully implemented yet, stored for future use
            const rootUserPassword = process.env['KB_ROOT_PASSWORD'] || 'admin';

            log.debug('Initializing root user', { email: rootUserEmail });

            // Create root admin user
            await query(
                `INSERT INTO users (id, email, display_name, role, permissions)
         VALUES ($1, $2, $3, $4, $5)`,
                [
                    'root-user',
                    rootUserEmail,
                    'System Administrator',
                    'admin',
                    JSON.stringify(['*']),  // Wildcard permission
                ]
            );

            log.debug('Root user initialized successfully');
        } catch (error) {
            log.error('Failed to initialize root user', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Find existing user or create new user from Azure AD profile.
     * 
     * This is called after successful Azure AD authentication:
     * 1. Search for user by ID or email (handles account linking)
     * 2. If found: Update profile fields that may have changed in Azure AD
     * 3. If not found: Create new user with default 'user' role
     * 
     * Profile fields synced from Azure AD:
     * - display_name
     * - email
     * - department
     * - job_title
     * - mobile_phone
     * 
     * @param adUser - User profile from Azure AD
     * @returns User record from database (with role and permissions)
     * @throws Error if database operation fails
     */
    async findOrCreateUser(adUser: AzureAdUser): Promise<User> {
        try {
            // Search by ID or Email (supports account linking scenarios)
            const existingUser = await queryOne<User>(
                'SELECT * FROM users WHERE id = $1 OR email = $2',
                [adUser.id, adUser.email]
            );

            if (existingUser) {
                // User exists - check if any Azure AD fields have changed
                let needsUpdate = false;
                const updates: any[] = [];
                const values: any[] = [];
                let paramIndex = 1;

                // Helper function to add field update
                const addUpdate = (field: string, value: any) => {
                    updates.push(`${field} = $${paramIndex++}`);
                    values.push(value);
                    needsUpdate = true;
                };

                // Check and update display name
                if (existingUser.display_name !== adUser.displayName) {
                    addUpdate('display_name', adUser.displayName);
                    existingUser.display_name = adUser.displayName;
                }

                // Check and update email
                if (existingUser.email !== adUser.email) {
                    addUpdate('email', adUser.email);
                    existingUser.email = adUser.email;
                }

                // Check and update department
                if (existingUser.department !== (adUser.department || null)) {
                    const newVal = adUser.department || null;
                    addUpdate('department', newVal);
                    existingUser.department = newVal;
                }

                // Check and update job title
                if (existingUser.job_title !== (adUser.jobTitle || null)) {
                    const newVal = adUser.jobTitle || null;
                    addUpdate('job_title', newVal);
                    existingUser.job_title = newVal;
                }

                // Check and update mobile phone
                if (existingUser.mobile_phone !== (adUser.mobilePhone || null)) {
                    const newVal = adUser.mobilePhone || null;
                    addUpdate('mobile_phone', newVal);
                    existingUser.mobile_phone = newVal;
                }

                // Apply updates if any fields changed
                if (needsUpdate) {
                    addUpdate('updated_at', new Date().toISOString());
                    values.push(existingUser.id); // Add ID for WHERE clause

                    await query(
                        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
                        values
                    );
                }

                // Parse permissions from JSON string if needed
                if (typeof existingUser.permissions === 'string') {
                    existingUser.permissions = JSON.parse(existingUser.permissions);
                }

                return existingUser;
            }

            // Create new user with default role
            log.debug('Creating new user from Azure AD', { email: adUser.email });

            const newUser: User = {
                id: adUser.id,
                email: adUser.email,
                display_name: adUser.displayName,
                role: 'user',  // Default role for new users
                permissions: [],
                department: adUser.department || null,
                job_title: adUser.jobTitle || null,
                mobile_phone: adUser.mobilePhone || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            await query(
                `INSERT INTO users (id, email, display_name, role, permissions, department, job_title, mobile_phone, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    newUser.id,
                    newUser.email,
                    newUser.display_name,
                    newUser.role,
                    JSON.stringify(newUser.permissions),
                    newUser.department,
                    newUser.job_title,
                    newUser.mobile_phone,
                    newUser.created_at,
                    newUser.updated_at,
                ]
            );

            return newUser;
        } catch (error) {
            log.error('Failed to find or create user', {
                error: error instanceof Error ? error.message : String(error),
                email: adUser.email
            });
            throw error;
        }
    }

    /**
     * Get all users for admin management interface.
     * Returns users sorted by creation date (newest first).
     * 
     * @returns Array of all users with parsed permissions
     */
    async getAllUsers(): Promise<User[]> {
        const users = await query<User>('SELECT * FROM users ORDER BY created_at DESC');

        // Parse permissions from JSON string to array
        return users.map(user => ({
            ...user,
            permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
        }));
    }

    /**
     * Update a user's role.
     * Used by administrators to grant/revoke access levels.
     * 
     * @param userId - ID of user to update
     * @param role - New role to assign (admin/manager/user)
     * @returns Updated user record, or undefined if not found
     */
    async updateUserRole(userId: string, role: 'admin' | 'leader' | 'user'): Promise<User | undefined> {
        await query(
            'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
            [role, userId]
        );

        // Fetch and return updated user
        const updatedUser = await queryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);

        // Parse permissions if needed
        if (updatedUser && typeof updatedUser.permissions === 'string') {
            updatedUser.permissions = JSON.parse(updatedUser.permissions);
        }

        return updatedUser;
    }

    /**
     * Update a user's permissions.
     * Used for bulk granting permissions or fine-grained access control.
     * 
     * @param userId - ID of user to update
     * @param permissions - Array of permission strings
     */
    async updateUserPermissions(userId: string, permissions: string[]): Promise<void> {
        await query(
            'UPDATE users SET permissions = $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(permissions), userId]
        );
    }

    /**
     * Record user IP access.
     * Extracts client IP from X-Forwarded-For header (nginx proxy) or falls back to remote address.
     * If the IP already exists for the user, updates the last_accessed_at timestamp.
     * 
     * @param userId - ID of the user
     * @param ipAddress - Client IP address
     */
    async recordUserIp(userId: string, ipAddress: string): Promise<void> {
        if (!ipAddress || ipAddress === 'unknown') {
            log.debug('Skipping IP recording: no valid IP', { userId });
            return;
        }

        try {
            // Use UPSERT pattern: INSERT ... ON CONFLICT ... DO UPDATE
            await query(
                `INSERT INTO user_ip_history (user_id, ip_address, last_accessed_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (user_id, ip_address) 
                 DO UPDATE SET last_accessed_at = NOW()`,
                [userId, ipAddress]
            );
            log.debug('User IP recorded', { userId, ipAddress: ipAddress.substring(0, 20) });
        } catch (error) {
            // Don't throw - IP recording is not critical
            log.warn('Failed to record user IP', {
                error: error instanceof Error ? error.message : String(error),
                userId
            });
        }
    }

    /**
     * Get IP history for a specific user.
     * Returns all IPs sorted by last access time (most recent first).
     * 
     * @param userId - ID of the user
     * @returns Array of IP history records
     */
    async getUserIpHistory(userId: string): Promise<UserIpHistory[]> {
        return query<UserIpHistory>(
            'SELECT * FROM user_ip_history WHERE user_id = $1 ORDER BY last_accessed_at DESC',
            [userId]
        );
    }

    /**
     * Get IP history for all users (admin view).
     * Returns IPs grouped by user, sorted by last access time.
     * 
     * @returns Map of user ID to their IP history records
     */
    async getAllUsersIpHistory(): Promise<Map<string, UserIpHistory[]>> {
        const allHistory = await query<UserIpHistory>(
            'SELECT * FROM user_ip_history ORDER BY user_id, last_accessed_at DESC'
        );

        const historyMap = new Map<string, UserIpHistory[]>();
        for (const record of allHistory) {
            const existing = historyMap.get(record.user_id) || [];
            existing.push(record);
            historyMap.set(record.user_id, existing);
        }

        return historyMap;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Singleton user service instance */
export const userService = new UserService();
