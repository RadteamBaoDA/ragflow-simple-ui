
import { ModelFactory } from '@/models/factory.js';
import { minioService } from '@/services/minio.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';

export class MinioBucketService {
    /**
     * Get buckets visible to a specific user based on their role and permissions.
     * @param user - Object containing user id, role, and permissions.
     * @returns Promise<MinioBucket[]> - Array of accessible bucket records.
     * @description Admins/Managers see all; others see only explicitly assigned buckets.
     */
    async getAccessibleBuckets(user: { id: string, role: string, permissions?: string[] | any }) {
        // Check global permission
        // Admin or user with 'manage_storage' or 'storage:read'
        const hasGlobalAccess = user.role === 'admin' ||
            (Array.isArray(user.permissions) && (
                user.permissions.includes('manage_storage')
            ));

        if (hasGlobalAccess) {
            // Return all buckets for privileged users
            return await ModelFactory.minioBucket.findAll({}, { orderBy: { created_at: 'desc' } });
        } else {
            // Granular check for regular users
            // 1. Get all teams the user belongs to
            const teamIds = await ModelFactory.userTeam.findTeamsByUserId(user.id);
            // 2. Find bucket IDs where user or their teams have access
            const bucketIds = await ModelFactory.documentPermission.findAccessibleBucketIds(user.id, teamIds);

            if (bucketIds.length > 0) {
                // Return specific buckets
                return await ModelFactory.minioBucket.findByIds(bucketIds);
            } else {
                // No access to any buckets
                return [];
            }
        }
    }

    /**
     * Get available buckets from MinIO that are not yet configured in DB.
     * @returns Promise<any[]> - List of unconfigured buckets.
     * @description Wrapper for minioService to discover new buckets.
     */
    async getAvailableBuckets() {
        return await minioService.getAvailableBuckets();
    }

    /**
     * Create a new bucket.
     * @param bucketName - Name of the bucket.
     * @param description - Description of the bucket.
     * @param user - User context for audit logging.
     * @returns Promise<any> - The created bucket record.
     * @description Wrapper for minioService with potential for extra business logic.
     */
    async createBucket(bucketName: string, description: string, user: { id: string, email: string, ip?: string }) {
        return await minioService.createBucket(bucketName, description, user);
    }

    /**
     * Delete a bucket.
     * @param bucketName - Name of the bucket to delete.
     * @param user - User context for audit logging.
     * @returns Promise<void>
     * @description Wrapper for minioService to delete a bucket and its metadata.
     */
    async deleteBucket(bucketName: string, user: { id: string, email: string, ip?: string }) {
        return await minioService.deleteBucket(bucketName, user);
    }
}

export const minioBucketService = new MinioBucketService();
