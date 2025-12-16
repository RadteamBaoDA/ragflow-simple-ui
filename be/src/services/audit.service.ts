/**
 * @fileoverview Audit log service.
 * 
 * This module handles audit logging for tracking user actions that modify
 * database or configuration. Provides comprehensive audit trail for security
 * and compliance reporting.
 * 
 * Features:
 * - Log any user action with details
 * - Query logs with pagination and filtering
 * - Support for various action types and resource types
 * 
 * Usage:
 * ```typescript
 * import { auditService, AuditAction, AuditResourceType } from './audit.service.js';
 * 
 * // Log a user role update
 * await auditService.log({
 *   userId: adminUser.id,
 *   userEmail: adminUser.email,
 *   action: AuditAction.UPDATE_ROLE,
 *   resourceType: AuditResourceType.USER,
 *   resourceId: targetUser.id,
 *   details: { oldRole: 'user', newRole: 'manager' },
 *   ipAddress: req.ip,
 * });
 * ```
 * 
 * @module services/audit
 */

import { query, queryOne } from '../db/index.js';
import { log } from './logger.service.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Audit action types for categorizing user actions.
 * Note: LOGIN, LOGOUT, LOGIN_FAILED are intentionally excluded to save database space.
 * These events are logged via logger.service.ts instead.
 */
export const AuditAction = {
    // User management actions
    CREATE_USER: 'create_user',
    UPDATE_USER: 'update_user',
    DELETE_USER: 'delete_user',
    UPDATE_ROLE: 'update_role',
    
    // Storage actions - buckets
    CREATE_BUCKET: 'create_bucket',
    DELETE_BUCKET: 'delete_bucket',
    
    // Storage actions - files
    UPLOAD_FILE: 'upload_file',
    DELETE_FILE: 'delete_file',
    DOWNLOAD_FILE: 'download_file',
    
    // Storage actions - folders
    CREATE_FOLDER: 'create_folder',
    DELETE_FOLDER: 'delete_folder',
    
    // Configuration actions
    UPDATE_CONFIG: 'update_config',
    RELOAD_CONFIG: 'reload_config',
    
    // System actions
    RUN_MIGRATION: 'run_migration',
    SYSTEM_START: 'system_start',
    SYSTEM_STOP: 'system_stop',
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];

/**
 * Resource types for categorizing affected resources.
 */
export const AuditResourceType = {
    USER: 'user',
    SESSION: 'session',
    BUCKET: 'bucket',
    FILE: 'file',
    CONFIG: 'config',
    SYSTEM: 'system',
    ROLE: 'role',
} as const;

export type AuditResourceTypeValue = typeof AuditResourceType[keyof typeof AuditResourceType];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Audit log entry from the database.
 */
export interface AuditLogEntry {
    /** Auto-increment primary key */
    id: number;
    /** User ID who performed the action (null for system actions) */
    user_id: string | null;
    /** User email at time of action */
    user_email: string;
    /** Action type performed */
    action: string;
    /** Type of resource affected */
    resource_type: string;
    /** ID of the affected resource (optional) */
    resource_id: string | null;
    /** Action-specific details as JSON */
    details: Record<string, any>;
    /** Client IP address */
    ip_address: string | null;
    /** Timestamp of the action */
    created_at: string;
}

/**
 * Parameters for creating an audit log entry.
 */
export interface AuditLogParams {
    /** User ID performing the action */
    userId?: string | null | undefined;
    /** User email */
    userEmail: string;
    /** Action type */
    action: AuditActionType | string;
    /** Resource type affected */
    resourceType: AuditResourceTypeValue | string;
    /** Resource ID (optional) */
    resourceId?: string | null | undefined;
    /** Additional details */
    details?: Record<string, any>;
    /** Client IP address */
    ipAddress?: string | null | undefined;
}

/**
 * Query parameters for fetching audit logs.
 */
export interface AuditLogQueryParams {
    /** Page number (1-based) */
    page?: number;
    /** Items per page */
    limit?: number;
    /** Filter by user ID */
    userId?: string;
    /** Filter by action type */
    action?: string;
    /** Filter by resource type */
    resourceType?: string;
    /** Filter by start date */
    startDate?: string;
    /** Filter by end date */
    endDate?: string;
    /** Search in user email or details */
    search?: string;
}

/**
 * Paginated audit log response.
 */
export interface AuditLogResponse {
    /** Array of audit log entries */
    data: AuditLogEntry[];
    /** Pagination metadata */
    pagination: {
        /** Current page number */
        page: number;
        /** Items per page */
        limit: number;
        /** Total number of items */
        total: number;
        /** Total number of pages */
        totalPages: number;
    };
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * Service for managing audit logs.
 * Handles logging user actions and querying audit history.
 */
class AuditService {
    /**
     * Log an audit event.
     * 
     * @param params - Audit log parameters
     * @returns The created audit log entry ID
     */
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

            const result = await queryOne<{ id: number }>(
                `INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, details, ip_address)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [
                    userId,
                    userEmail,
                    action,
                    resourceType,
                    resourceId,
                    JSON.stringify(details),
                    ipAddress,
                ]
            );

            log.debug('Audit log created', {
                id: result?.id,
                action,
                resourceType,
                userId,
            });

            return result?.id ?? null;
        } catch (error) {
            // Don't throw - audit logging should not break main functionality
            log.error('Failed to create audit log', {
                error: error instanceof Error ? error.message : String(error),
                action: params.action,
                resourceType: params.resourceType,
            });
            return null;
        }
    }

    /**
     * Get audit logs with pagination and filtering.
     * 
     * @param params - Query parameters
     * @returns Paginated audit log response
     */
    async getLogs(params: AuditLogQueryParams = {}): Promise<AuditLogResponse> {
        const {
            page = 1,
            limit = 50,
            userId,
            action,
            resourceType,
            startDate,
            endDate,
            search,
        } = params;

        // Build WHERE clauses
        const conditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (userId) {
            conditions.push(`user_id = $${paramIndex++}`);
            values.push(userId);
        }

        if (action) {
            conditions.push(`action = $${paramIndex++}`);
            values.push(action);
        }

        if (resourceType) {
            conditions.push(`resource_type = $${paramIndex++}`);
            values.push(resourceType);
        }

        if (startDate) {
            conditions.push(`created_at >= $${paramIndex++}`);
            values.push(startDate);
        }

        if (endDate) {
            conditions.push(`created_at <= $${paramIndex++}`);
            values.push(endDate);
        }

        if (search) {
            // Sanitize search input - escape special LIKE/ILIKE characters
            const sanitizedSearch = search
                .replace(/\\/g, '\\\\')
                .replace(/%/g, '\\%')
                .replace(/_/g, '\\_');
            conditions.push(`(user_email ILIKE $${paramIndex} OR details::text ILIKE $${paramIndex})`);
            values.push(`%${sanitizedSearch}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Get total count
        const countResult = await queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
            values
        );
        const total = parseInt(countResult?.count || '0', 10);

        // Calculate pagination
        const offset = (page - 1) * limit;
        const totalPages = Math.ceil(total / limit);

        // Get paginated data
        const data = await query<AuditLogEntry>(
            `SELECT * FROM audit_logs ${whereClause} 
             ORDER BY created_at DESC 
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...values, limit, offset]
        );

        // Parse JSON details for each entry
        const parsedData = data.map(entry => ({
            ...entry,
            details: typeof entry.details === 'string' 
                ? JSON.parse(entry.details) 
                : entry.details,
        }));

        return {
            data: parsedData,
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    }

    /**
     * Get available action types from existing logs.
     * Useful for filter dropdowns.
     */
    async getActionTypes(): Promise<string[]> {
        const result = await query<{ action: string }>(
            'SELECT DISTINCT action FROM audit_logs ORDER BY action'
        );
        return result.map(r => r.action);
    }

    /**
     * Get available resource types from existing logs.
     * Useful for filter dropdowns.
     */
    async getResourceTypes(): Promise<string[]> {
        const result = await query<{ resource_type: string }>(
            'SELECT DISTINCT resource_type FROM audit_logs ORDER BY resource_type'
        );
        return result.map(r => r.resource_type);
    }

    /**
     * Delete old audit logs (for maintenance).
     * 
     * @param olderThanDays - Delete logs older than this many days
     * @returns Number of deleted records
     */
    async deleteOldLogs(olderThanDays: number): Promise<number> {
        // Validate input to prevent SQL injection
        const days = Math.max(1, Math.floor(Number(olderThanDays)));
        if (!Number.isFinite(days)) {
            throw new Error('Invalid olderThanDays value');
        }
        
        const result = await queryOne<{ count: string }>(
            `WITH deleted AS (
                DELETE FROM audit_logs 
                WHERE created_at < NOW() - INTERVAL '1 day' * $1
                RETURNING *
            ) SELECT COUNT(*) as count FROM deleted`,
            [days]
        );
        
        const deletedCount = parseInt(result?.count || '0', 10);
        
        if (deletedCount > 0) {
            log.debug('Deleted old audit logs', { count: deletedCount, olderThanDays });
        }
        
        return deletedCount;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Singleton audit service instance */
export const auditService = new AuditService();
