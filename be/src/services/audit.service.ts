
// Centralized audit logging for user actions and resource changes.
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { AuditLog } from '@/models/types.js';

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
    PROMPT: 'prompt',
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
    /**
     * Persist a single audit entry.
     * @param params - The audit log parameters.
     * @returns Promise<number | null> - The ID of the created log entry or null on failure.
     * @description Best-effort logging to avoid throwing on logging failures.
     */
    async log(params: AuditLogParams): Promise<number | null> {
        try {
            // Destructure params with default values
            const {
                userId = null,
                userEmail,
                action,
                resourceType,
                resourceId = null,
                details = {},
                ipAddress = null,
            } = params;

            // Create audit log entry using model factory
            const logEntry = await ModelFactory.auditLog.create({
                user_id: userId,
                user_email: userEmail,
                action,
                resource_type: resourceType,
                resource_id: resourceId,
                details: JSON.stringify(details),
                ip_address: ipAddress,
            });

            // Log debug info for successful creation
            log.debug('Audit log created', {
                id: logEntry.id,
                action,
                resourceType,
                userId,
            });

            // Return the new log ID
            return logEntry.id;
        } catch (error) {
            // Log error but suppress exception to prevent disrupting main flow
            log.error('Failed to create audit log', {
                error: error instanceof Error ? error.message : String(error),
                action: params.action,
                resourceType: params.resourceType,
            });
            return null;
        }
    }

    /**
     * Retrieve paginated logs with lightweight filtering.
     * @param filters - Filtering criteria (userId, action, resourceType).
     * @param limit - Number of logs per page.
     * @param offset - Pagination offset.
     * @returns Promise<AuditLogResponse> - Paginated audit logs.
     * @description Fetches logs based on filters and pagination, returning metadata.
     */
    async getLogs(filters: any = {}, limit: number = 50, offset: number = 0): Promise<AuditLogResponse> {
        // Build where clause based on filters
        const whereClause: any = {};
        if (filters.userId) whereClause.user_id = filters.userId;
        if (filters.action) whereClause.action = filters.action;
        if (filters.resourceType) whereClause.resource_type = filters.resourceType;

        // Fetch paginated data from DB
        const data = await ModelFactory.auditLog.findAll(whereClause, {
            orderBy: { created_at: 'desc' },
            limit,
            offset
        });

        // Estimate total count for pagination metadata
        const total = data.length + offset + (data.length === limit ? limit : 0);

        // Calculate total pages
        const totalPages = Math.ceil(total / limit);
        // Calculate current page number
        const page = Math.floor(offset / limit) + 1;

        // Parse details JSON string back to object
        const parsedData = data.map(entry => ({
            ...entry,
            details: typeof entry.details === 'string' ? JSON.parse(entry.details as string) : entry.details
        }));

        // Return structured response
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

    /**
     * Return audit history for a specific resource.
     * @param resourceType - The type of resource.
     * @param resourceId - The ID of the resource.
     * @returns Promise<AuditLog[]> - Array of audit logs.
     * @description Fetches logs filtered by resource type and ID.
     */
    async getResourceHistory(resourceType: string, resourceId: string): Promise<AuditLog[]> {
        // Fetch logs for the specific resource
        const logs = await ModelFactory.auditLog.findAll({
            resource_type: resourceType,
            resource_id: resourceId
        }, { orderBy: { created_at: 'desc' } });

        // Parse details field for each log
        return logs.map(entry => ({
            ...entry,
            details: typeof entry.details === 'string' ? JSON.parse(entry.details as string) : entry.details
        }));
    }

    /**
     * Produce CSV snapshot for bulk export/download.
     * @param filters - Filters to apply to the export.
     * @returns Promise<string> - CSV string content.
     * @description Generates a CSV string containing all logs matching the filters.
     */
    async exportLogsToCsv(filters: any): Promise<string> {
        // Fetch a large batch of logs (limit 1,000,000)
        const response = await this.getLogs(filters, 1000000, 0);
        const logs = response.data;

        // Return empty string if no logs found
        if (logs.length === 0) return '';

        // Define CSV header
        const header = ['ID', 'User Email', 'Action', 'Resource Type', 'Resource ID', 'IP Address', 'Created At', 'Details'].join(',');

        // Map logs to CSV rows
        const rows = logs.map(log => {
            // Escape double quotes in details JSON
            const details = JSON.stringify(log.details).replace(/"/g, '""');
            // Construct row string
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

        // Join header and rows with newlines
        return [header, ...rows].join('\n');
    }

    /**
     * Expose allowed action type values.
     * @returns Promise<string[]> - List of action types.
     * @description Returns all possible audit action types.
     */
    async getActionTypes(): Promise<string[]> {
        // Return values of AuditAction constant
        return Object.values(AuditAction);
    }

    /**
     * Expose allowed resource type values.
     * @returns Promise<string[]> - List of resource types.
     * @description Returns all possible audit resource types.
     */
    async getResourceTypes(): Promise<string[]> {
        // Return values of AuditResourceType constant
        return Object.values(AuditResourceType);
    }

    /**
     * Placeholder for retention policy hook.
     * @param olderThanDays - Threshold in days for log deletion.
     * @returns Promise<number> - Number of deleted logs.
     * @description Intended for future implementation of log retention policies.
     */
    async deleteOldLogs(olderThanDays: number): Promise<number> {
        // Currently returns 0 as not implemented
        return 0;
    }
}

export const auditService = new AuditService();
