
import { ModelFactory } from '../models/factory.js';
import { log } from './logger.service.js';
import { AuditLog } from '../models/types.js';

export const AuditAction = {
    CREATE_USER: 'create_user',
    UPDATE_USER: 'update_user',
    DELETE_USER: 'delete_user',
    UPDATE_ROLE: 'update_role',
    CREATE_TEAM: 'create_team',
    UPDATE_TEAM: 'update_team',
    DELETE_TEAM: 'delete_team',
    CREATE_BUCKET: 'create_bucket',
    DELETE_BUCKET: 'delete_bucket',
    UPLOAD_FILE: 'upload_file',
    DELETE_FILE: 'delete_file',
    DOWNLOAD_FILE: 'download_file',
    CREATE_FOLDER: 'create_folder',
    DELETE_FOLDER: 'delete_folder',
    UPDATE_CONFIG: 'update_config',
    RELOAD_CONFIG: 'reload_config',
    CREATE_SOURCE: 'create_source',
    UPDATE_SOURCE: 'update_source',
    DELETE_SOURCE: 'delete_source',
    CREATE_BROADCAST: 'create_broadcast',
    UPDATE_BROADCAST: 'update_broadcast',
    DELETE_BROADCAST: 'delete_broadcast',
    DISMISS_BROADCAST: 'dismiss_broadcast',
    SET_PERMISSION: 'set_permission',
    BATCH_DELETE: 'batch_delete',
    RUN_MIGRATION: 'run_migration',
    SYSTEM_START: 'system_start',
    SYSTEM_STOP: 'system_stop',
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];

export const AuditResourceType = {
    USER: 'user',
    TEAM: 'team',
    SESSION: 'session',
    BUCKET: 'bucket',
    FILE: 'file',
    CONFIG: 'config',
    KNOWLEDGE_BASE_SOURCE: 'knowledge_base_source',
    BROADCAST_MESSAGE: 'broadcast_message',
    PERMISSION: 'permission',
    SYSTEM: 'system',
    ROLE: 'role',
} as const;

export type AuditResourceTypeValue = typeof AuditResourceType[keyof typeof AuditResourceType];

export interface AuditLogParams {
    userId?: string | null | undefined;
    userEmail: string;
    action: AuditActionType | string;
    resourceType: AuditResourceTypeValue | string;
    resourceId?: string | null | undefined;
    details?: Record<string, any>;
    ipAddress?: string | null | undefined;
}

export interface AuditLogQueryParams {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
}

export interface AuditLogResponse {
    data: AuditLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

class AuditService {
    async log(params: AuditLogParams): Promise<number | null> {
        try {
            const {
                userId = null,
                userEmail,
                action,
                resourceType,
                resourceId = null,
                details = {},
                ipAddress = null,
            } = params;

            const logEntry = await ModelFactory.auditLog.create({
                user_id: userId,
                user_email: userEmail,
                action,
                resource_type: resourceType,
                resource_id: resourceId,
                details: JSON.stringify(details),
                ip_address: ipAddress,
            });

            log.debug('Audit log created', {
                id: logEntry.id,
                action,
                resourceType,
                userId,
            });

            return logEntry.id;
        } catch (error) {
            log.error('Failed to create audit log', {
                error: error instanceof Error ? error.message : String(error),
                action: params.action,
                resourceType: params.resourceType,
            });
            return null;
        }
    }

    async getLogs(filters: any = {}, limit: number = 50, offset: number = 0): Promise<AuditLogResponse> {
         const whereClause: any = {};
         if (filters.userId) whereClause.user_id = filters.userId;
         if (filters.action) whereClause.action = filters.action;
         if (filters.resourceType) whereClause.resource_type = filters.resourceType;

         // Use DB pagination
         const data = await ModelFactory.auditLog.findAll(whereClause, {
             orderBy: { created_at: 'desc' },
             limit,
             offset
         });

         // Need count for pagination metadata.
         // Assuming client doesn't strictly need total or we fetch it separately.
         // For now, returning length + offset as approximation or 0 if empty.
         const total = data.length + offset + (data.length === limit ? limit : 0); // rough estimate

         const totalPages = Math.ceil(total / limit);
         const page = Math.floor(offset / limit) + 1;

         const parsedData = data.map(entry => ({
             ...entry,
             details: typeof entry.details === 'string' ? JSON.parse(entry.details as string) : entry.details
         }));

         return {
             data: parsedData,
             pagination: {
                 page,
                 limit,
                 total,
                 totalPages
             }
         };
    }

    async getResourceHistory(resourceType: string, resourceId: string): Promise<AuditLog[]> {
        const logs = await ModelFactory.auditLog.findAll({
            resource_type: resourceType,
            resource_id: resourceId
        }, { orderBy: { created_at: 'desc' } });

        return logs.map(entry => ({
             ...entry,
             details: typeof entry.details === 'string' ? JSON.parse(entry.details as string) : entry.details
         }));
    }

    async exportLogsToCsv(filters: any): Promise<string> {
        const response = await this.getLogs(filters, 1000000, 0);
        const logs = response.data;

        if (logs.length === 0) return '';

        const header = ['ID', 'User Email', 'Action', 'Resource Type', 'Resource ID', 'IP Address', 'Created At', 'Details'].join(',');
        const rows = logs.map(log => {
            const details = JSON.stringify(log.details).replace(/"/g, '""');
            return [
                log.id,
                log.user_email,
                log.action,
                log.resource_type,
                log.resource_id,
                log.ip_address,
                log.created_at,
                `"${details}"`
            ].join(',');
        });

        return [header, ...rows].join('\n');
    }

    async getActionTypes(): Promise<string[]> {
        return Object.values(AuditAction);
    }

    async getResourceTypes(): Promise<string[]> {
        return Object.values(AuditResourceType);
    }

    async deleteOldLogs(olderThanDays: number): Promise<number> {
        return 0;
    }
}

export const auditService = new AuditService();
