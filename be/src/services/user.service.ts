
import { ModelFactory } from '@/models/factory.js';
import { config } from '@/config/index.js';
import { log } from '@/services/logger.service.js';
import { AzureAdUser } from '@/services/auth.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { User, UserIpHistory } from '@/models/types.js';

export class UserService {
    async initializeRootUser(): Promise<void> {
        try {
            const users = await ModelFactory.user.findAll();
            if (users.length > 0) {
                log.debug('Users exist, skipping root user initialization');
                return;
            }

            const rootUserEmail = config.rootUser;

            log.debug('Initializing root user', { email: rootUserEmail });

            await ModelFactory.user.create({
                id: 'root-user',
                email: rootUserEmail,
                display_name: 'System Administrator',
                role: 'admin',
                permissions: JSON.stringify(['*']),
            });

            log.debug('Root user initialized successfully');
        } catch (error) {
            log.error('Failed to initialize root user', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    async findOrCreateUser(adUser: AzureAdUser, ipAddress?: string): Promise<User> {
        try {
            // Check by ID first
            let existingUser = await ModelFactory.user.findById(adUser.id);
            if (!existingUser) {
                // Check by email
                existingUser = await ModelFactory.user.findByEmail(adUser.email);
            }

            if (existingUser) {
                let needsUpdate = false;
                const updateData: any = {};

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

                if (needsUpdate) {
                    existingUser = await ModelFactory.user.update(existingUser.id, updateData);

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

                if (ipAddress) {
                    await this.recordUserIp(existingUser!.id, ipAddress);
                }

                return existingUser!;
            }

            log.debug('Creating new user from Azure AD', { email: adUser.email });

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

            await auditService.log({
                userId: newUser.id,
                userEmail: newUser.email,
                action: AuditAction.CREATE_USER,
                resourceType: AuditResourceType.USER,
                resourceId: newUser.id,
                details: { source: 'AzureAD Login' },
                ipAddress,
            });

            if (ipAddress) {
                await this.recordUserIp(newUser.id, ipAddress);
            }

            return newUser;
        } catch (error) {
            log.error('Failed to find or create user', {
                error: error instanceof Error ? error.message : String(error),
                email: adUser.email
            });
            throw error;
        }
    }

    async getAllUsers(roles?: string[]): Promise<User[]> {
        const filter: any = {};
        const users = await ModelFactory.user.findAll(filter);

        if (roles && roles.length > 0) {
            return users.filter(u => roles.includes(u.role));
        }

        return users.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    }

    async createUser(data: any, user?: { id: string, email: string, ip?: string }): Promise<User> {
        const newUser = await ModelFactory.user.create(data);
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

    async updateUser(id: string, data: any, user?: { id: string, email: string, ip?: string }): Promise<User | undefined> {
        const updatedUser = await ModelFactory.user.update(id, data);
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

    async deleteUser(id: string, user?: { id: string, email: string, ip?: string }): Promise<void> {
        await ModelFactory.user.delete(id);
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

    async getUserById(userId: string): Promise<User | undefined> {
        return ModelFactory.user.findById(userId);
    }

    async updateUserRole(userId: string, role: 'admin' | 'leader' | 'user'): Promise<User | undefined> {
        return ModelFactory.user.update(userId, { role });
    }

    async updateUserPermissions(userId: string, permissions: string[], actor?: { id: string, email: string, ip?: string }): Promise<void> {
        await ModelFactory.user.update(userId, { permissions: JSON.stringify(permissions) });

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

    async recordUserIp(userId: string, ipAddress: string): Promise<void> {
        if (!ipAddress || ipAddress === 'unknown') {
            log.debug('Skipping IP recording: no valid IP', { userId });
            return;
        }

        try {
            const existing = await ModelFactory.userIpHistory.findByUserAndIp(userId, ipAddress);
            if (existing) {
                // Throttle updates: only update if more than 60 seconds have passed
                const THROTTLE_MS = 60 * 1000;
                const now = new Date();
                if (now.getTime() - existing.last_accessed_at.getTime() > THROTTLE_MS) {
                    await ModelFactory.userIpHistory.update(existing.id, { last_accessed_at: now });
                    log.debug('User IP updated', { userId, ipAddress: ipAddress.substring(0, 20) });
                }
            } else {
                await ModelFactory.userIpHistory.create({
                    user_id: userId,
                    ip_address: ipAddress,
                    last_accessed_at: new Date()
                });
                log.debug('User IP recorded', { userId, ipAddress: ipAddress.substring(0, 20) });
            }
        } catch (error) {
            log.warn('Failed to record user IP', {
                error: error instanceof Error ? error.message : String(error),
                userId
            });
        }
    }

    async getUserIpHistory(userId: string): Promise<UserIpHistory[]> {
        const history = await ModelFactory.userIpHistory.findAll({
            user_id: userId
        });
        return history.sort((a, b) => b.last_accessed_at.getTime() - a.last_accessed_at.getTime());
    }

    async getAllUsersIpHistory(): Promise<Map<string, UserIpHistory[]>> {
        const allHistory = await ModelFactory.userIpHistory.findAll();

        allHistory.sort((a, b) => {
            if (a.user_id === b.user_id) {
                return b.last_accessed_at.getTime() - a.last_accessed_at.getTime();
            }
            return a.user_id.localeCompare(b.user_id);
        });

        const historyMap = new Map<string, UserIpHistory[]>();
        for (const record of allHistory) {
            const existing = historyMap.get(record.user_id) || [];
            existing.push(record);
            historyMap.set(record.user_id, existing);
        }

        return historyMap;
    }
}

export const userService = new UserService();
