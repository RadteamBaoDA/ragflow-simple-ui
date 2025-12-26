
// Manages user lifecycle, role/permission updates, and IP history tracking.
import { ModelFactory } from '@/models/factory.js';
import { config } from '@/config/index.js';
import { log } from '@/services/logger.service.js';
import { AzureAdUser } from '@/services/auth.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { User, UserIpHistory } from '@/models/types.js';

/**
 * UserService
 * Manages user lifecycle, role/permission updates, and IP history tracking.
 * Handles Azure AD user synchronization, admin operations, and audit logging.
 */
export class UserService {
    /**
     * Initialize root admin user when database is empty.
     * Creates a system administrator account on first startup.
     * Skips if any users already exist in the database.
     */
    async initializeRootUser(): Promise<void> {
        try {
            // Check if any users exist in the database
            const users = await ModelFactory.user.findAll();

            // Skip initialization if users already exist
            if (users.length > 0) {
                log.debug('Users exist, skipping root user initialization');
                return;
            }

            // Get root user email from configuration
            const rootUserEmail = config.rootUser;

            log.debug('Initializing root user', { email: rootUserEmail });

            // Create the root admin user with full permissions
            await ModelFactory.user.create({
                id: 'root-user',
                email: rootUserEmail,
                display_name: 'System Administrator',
                role: 'admin',
                permissions: JSON.stringify(['*']),  // Wildcard grants all permissions
            });

            log.debug('Root user initialized successfully');
        } catch (error) {
            // Log error but don't throw - allow app to start even if root user creation fails
            log.error('Failed to initialize root user', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Find existing user or create new one from Azure AD profile.
     * Syncs user data and updates changed fields with audit logging.
     * @param adUser - Azure AD user profile data
     * @param ipAddress - Optional client IP for tracking
     * @returns The found or created User record
     * @throws Error if database operation fails
     */
    async findOrCreateUser(adUser: AzureAdUser, ipAddress?: string): Promise<User> {
        try {
            // First try to find user by Azure AD ID (primary lookup)
            let existingUser = await ModelFactory.user.findById(adUser.id);

            // Fallback: check by email if ID lookup fails
            if (!existingUser) {
                existingUser = await ModelFactory.user.findByEmail(adUser.email);
            }

            // If user exists, check for profile updates from Azure AD
            if (existingUser) {
                let needsUpdate = false;
                const updateData: any = {};

                // Compare and track changes for each synced field
                if (existingUser.display_name !== adUser.displayName) {
                    updateData.display_name = adUser.displayName;
                    needsUpdate = true;
                }
                if (existingUser.email !== adUser.email) {
                    updateData.email = adUser.email;
                    needsUpdate = true;
                }
                if (existingUser.department !== (adUser.department || null)) {
                    updateData.department = adUser.department || null;
                    needsUpdate = true;
                }
                if (existingUser.job_title !== (adUser.jobTitle || null)) {
                    updateData.job_title = adUser.jobTitle || null;
                    needsUpdate = true;
                }
                if (existingUser.mobile_phone !== (adUser.mobilePhone || null)) {
                    updateData.mobile_phone = adUser.mobilePhone || null;
                    needsUpdate = true;
                }

                // Apply updates if any fields changed
                if (needsUpdate) {
                    existingUser = await ModelFactory.user.update(existingUser.id, updateData);

                    // Log profile sync as audit event
                    await auditService.log({
                        userId: existingUser!.id,
                        userEmail: existingUser!.email,
                        action: AuditAction.UPDATE_USER,
                        resourceType: AuditResourceType.USER,
                        resourceId: existingUser!.id,
                        details: { source: 'AzureAD Sync', updates: updateData },
                        ipAddress,
                    });
                }

                // Record IP address for login tracking
                if (ipAddress) {
                    await this.recordUserIp(existingUser!.id, ipAddress);
                }

                return existingUser!;
            }

            // User doesn't exist - create new user from Azure AD data
            log.debug('Creating new user from Azure AD', { email: adUser.email });

            // Create user with default 'user' role and empty permissions
            const newUser = await ModelFactory.user.create({
                id: adUser.id,
                email: adUser.email,
                display_name: adUser.displayName,
                role: 'user',
                permissions: JSON.stringify([]),
                department: adUser.department || null,
                job_title: adUser.jobTitle || null,
                mobile_phone: adUser.mobilePhone || null,
            });

            // Log user creation as audit event
            await auditService.log({
                userId: newUser.id,
                userEmail: newUser.email,
                action: AuditAction.CREATE_USER,
                resourceType: AuditResourceType.USER,
                resourceId: newUser.id,
                details: { source: 'AzureAD Login' },
                ipAddress,
            });

            // Record IP address for new user
            if (ipAddress) {
                await this.recordUserIp(newUser.id, ipAddress);
            }

            return newUser;
        } catch (error) {
            // Log error with context and re-throw
            log.error('Failed to find or create user', {
                error: error instanceof Error ? error.message : String(error),
                email: adUser.email
            });
            throw error;
        }
    }

    /**
     * Get all users, optionally filtered by role.
     * Returns users sorted by creation date (newest first).
     * @param roles - Optional array of roles to filter by
     * @returns Array of User records
     */
    async getAllUsers(roles?: string[]): Promise<User[]> {
        // Initialize empty filter object
        const filter: any = {};

        // Fetch all users from database
        const users = await ModelFactory.user.findAll(filter);

        // If role filter provided, filter users by matching roles
        if (roles && roles.length > 0) {
            return users.filter(u => roles.includes(u.role));
        }

        // Sort by creation date descending (newest first)
        return users.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    }

    /**
     * Create a new user record.
     * Logs audit entry if actor context is provided.
     * @param data - User data for creation
     * @param user - Optional actor for audit logging
     * @returns The created User record
     */
    async createUser(data: any, user?: { id: string, email: string, ip?: string }): Promise<User> {
        // Create user in database
        const newUser = await ModelFactory.user.create(data);

        // Log audit event if actor provided
        if (user) {
            await auditService.log({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.CREATE_USER,
                resourceType: AuditResourceType.USER,
                resourceId: newUser.id,
                details: { source: 'Admin Create' },
                ipAddress: user.ip,
            });
        }
        return newUser;
    }

    /**
     * Update an existing user's profile.
     * Logs audit entry with change details if actor provided.
     * @param id - User ID to update
     * @param data - Partial user data to update
     * @param user - Optional actor for audit logging
     * @returns Updated User or undefined if not found
     */
    async updateUser(id: string, data: any, user?: { id: string, email: string, ip?: string }): Promise<User | undefined> {
        // Apply updates to user record
        const updatedUser = await ModelFactory.user.update(id, data);

        // Log audit event with changes if actor provided and update succeeded
        if (user && updatedUser) {
            await auditService.log({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.UPDATE_USER,
                resourceType: AuditResourceType.USER,
                resourceId: id,
                details: { source: 'Admin Update', changes: data },
                ipAddress: user.ip,
            });
        }
        return updatedUser;
    }

    /**
     * Delete a user from the system.
     * Logs audit entry if actor context is provided.
     * @param id - User ID to delete
     * @param user - Optional actor for audit logging
     */
    async deleteUser(id: string, user?: { id: string, email: string, ip?: string }): Promise<void> {
        // Remove user from database
        await ModelFactory.user.delete(id);

        // Log audit event if actor provided
        if (user) {
            await auditService.log({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.DELETE_USER,
                resourceType: AuditResourceType.USER,
                resourceId: id,
                details: { source: 'Admin Delete' },
                ipAddress: user.ip,
            });
        }
    }

    /**
     * Get a single user by their ID.
     * @param userId - User ID to look up
     * @returns User record or undefined if not found
     */
    async getUserById(userId: string): Promise<User | undefined> {
        return ModelFactory.user.findById(userId);
    }

    /**
     * Update a user's global role.
     * Includes security checks to prevent self-modification and unauthorized admin promotion.
     * Logs audit event.
     * @param userId - User ID to update
     * @param role - New role: 'admin', 'leader', or 'user'
     * @param actor - The user performing the action
     * @returns Updated User or undefined if not found
     * @throws Error if validation or security checks fail
     */
    async updateUserRole(userId: string, role: string, actor: { id: string, role: string, email: string, ip?: string }): Promise<User | undefined> {
        // Validate UUID format for id (unless it's a special system user)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId) && userId !== 'root-user' && userId !== 'dev-user-001') {
            throw new Error('Invalid user ID format');
        }

        // Validate role value
        const validRoles = ['admin', 'leader', 'user'] as const;
        if (!validRoles.includes(role as any)) {
            throw new Error('Invalid role');
        }

        // SECURITY: Prevent self-modification of role
        if (actor.id === userId) {
            log.warn('Self role modification attempt blocked', {
                userId: actor.id,
                attemptedRole: role,
            });
            throw new Error('Cannot modify your own role');
        }

        // SECURITY: Prevent privilege escalation by managers
        // Only admins can promote someone to admin
        if (role === 'admin' && actor.role !== 'admin') {
            log.warn('Unauthorized admin promotion attempt', {
                userId: actor.id,
                userRole: actor.role,
                targetUserId: userId,
            });
            throw new Error('Only administrators can grant admin role');
        }

        const updatedUser = await ModelFactory.user.update(userId, { role });

        if (updatedUser) {
            // Log audit event for role change
            await auditService.log({
                userId: actor.id,
                userEmail: actor.email || 'unknown',
                action: AuditAction.UPDATE_ROLE,
                resourceType: AuditResourceType.USER,
                resourceId: userId,
                details: {
                    targetEmail: updatedUser.email,
                    newRole: role,
                },
                ipAddress: actor.ip,
            });

            log.debug('User role updated', {
                adminId: actor.id,
                targetUserId: userId,
                newRole: role
            });
        }

        return updatedUser;
    }

    /**
     * Update a user's permission array.
     * Logs audit entry with permission changes if actor provided.
     * @param userId - User ID to update
     * @param permissions - New permissions array
     * @param actor - Optional actor for audit logging
     */
    async updateUserPermissions(userId: string, permissions: string[], actor?: { id: string, email: string, ip?: string }): Promise<void> {
        // Update permissions as JSON string
        await ModelFactory.user.update(userId, { permissions: JSON.stringify(permissions) });

        // Log audit event with permission details if actor provided
        if (actor) {
            await auditService.log({
                userId: actor.id,
                userEmail: actor.email,
                action: AuditAction.UPDATE_USER,
                resourceType: AuditResourceType.USER,
                resourceId: userId,
                details: { action: 'update_permissions', permissions },
                ipAddress: actor.ip,
            });
        }
    }

    /**
     * Record a user's IP address for login tracking.
     * Uses throttling to avoid excessive database updates on rapid refreshes.
     * @param userId - User ID to record IP for
     * @param ipAddress - Client IP address
     */
    async recordUserIp(userId: string, ipAddress: string): Promise<void> {
        // Skip recording if IP is invalid or unknown
        if (!ipAddress || ipAddress === 'unknown') {
            log.debug('Skipping IP recording: no valid IP', { userId });
            return;
        }

        try {
            // Check if this user+IP combination already exists
            const existing = await ModelFactory.userIpHistory.findByUserAndIp(userId, ipAddress);

            if (existing) {
                // Throttle updates: only update if more than 60 seconds have passed
                // This prevents database spam on rapid page refreshes
                const THROTTLE_MS = 60 * 1000;
                const now = new Date();

                // Check if enough time has passed since last access
                if (now.getTime() - existing.last_accessed_at.getTime() > THROTTLE_MS) {
                    // Update last accessed timestamp
                    await ModelFactory.userIpHistory.update(existing.id, { last_accessed_at: now });
                    log.debug('User IP updated', { userId, ipAddress: ipAddress.substring(0, 20) });
                }
                // Otherwise skip update (within throttle window)
            } else {
                // New IP for this user - create new record
                await ModelFactory.userIpHistory.create({
                    user_id: userId,
                    ip_address: ipAddress,
                    last_accessed_at: new Date()
                });
                log.debug('User IP recorded', { userId, ipAddress: ipAddress.substring(0, 20) });
            }
        } catch (error) {
            // Log warning but don't throw - IP tracking is non-critical
            log.warn('Failed to record user IP', {
                error: error instanceof Error ? error.message : String(error),
                userId
            });
        }
    }

    /**
     * Get IP address history for a specific user.
     * Returns records sorted by most recent access first.
     * @param userId - User ID to get history for
     * @returns Array of UserIpHistory records
     */
    async getUserIpHistory(userId: string): Promise<UserIpHistory[]> {
        // Fetch all IP records for the specified user
        const history = await ModelFactory.userIpHistory.findAll({
            user_id: userId
        });

        // Sort by last accessed descending (most recent first)
        return history.sort((a, b) => b.last_accessed_at.getTime() - a.last_accessed_at.getTime());
    }

    /**
     * Get IP address history for all users.
     * Returns a Map keyed by user ID with their IP history records.
     * @returns Map of userId to array of UserIpHistory records
     */
    async getAllUsersIpHistory(): Promise<Map<string, UserIpHistory[]>> {
        // Fetch all IP history records from database
        const allHistory = await ModelFactory.userIpHistory.findAll();

        // Sort records: first by user_id, then by last_accessed_at (most recent first)
        allHistory.sort((a, b) => {
            if (a.user_id === b.user_id) {
                // Same user - sort by access time descending
                return b.last_accessed_at.getTime() - a.last_accessed_at.getTime();
            }
            // Different users - sort alphabetically by user_id
            return a.user_id.localeCompare(b.user_id);
        });

        // Build map grouping records by user ID
        const historyMap = new Map<string, UserIpHistory[]>();

        for (const record of allHistory) {
            // Get existing array for this user or create new empty array
            const existing = historyMap.get(record.user_id) || [];

            // Add current record to user's history
            existing.push(record);

            // Update map with new array
            historyMap.set(record.user_id, existing);
        }

        return historyMap;
    }
}

export const userService = new UserService();
