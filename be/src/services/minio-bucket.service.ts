import { ModelFactory } from '@/models/factory.js';
import { minioService } from '@/services/minio.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';

export class MinioBucketService {
    /**
     * Get buckets visible to a specific user based on their role and permissions.
     */
    async getAccessibleBuckets(user: { id: string, role: string, permissions?: string[] | any }) {
        // Check global permission
        // Admin or user with 'manage_storage' or 'storage:read'
        const hasGlobalAccess = user.role === 'admin' ||
            (Array.isArray(user.permissions) && (
                user.permissions.includes('manage_storage')
            ));

        if (hasGlobalAccess) {
            // Return all buckets
            return await ModelFactory.minioBucket.findAll({}, { orderBy: { created_at: 'desc' } });
        } else {
            // Granular check for regular users
            const teamIds = await ModelFactory.userTeam.findTeamsByUserId(user.id);
            const bucketIds = await ModelFactory.documentPermission.findAccessibleBucketIds(user.id, teamIds);

            if (bucketIds.length > 0) {
                return await ModelFactory.minioBucket.findByIds(bucketIds);
            } else {
                return [];
            }
        }
    }

    /**
     * Get available buckets from MinIO that are not yet configured in DB.
     * Wrapper for minioService.
     */
    async getAvailableBuckets() {
        return await minioService.getAvailableBuckets();
    }

    /**
     * Create a new bucket.
     * Wrapper for minioService but could contain extra business logic layer.
     */
    async createBucket(bucketName: string, description: string, user: { id: string, email: string, ip?: string }) {
        return await minioService.createBucket(bucketName, description, user);
    }

    /**
     * Delete a bucket.
     * Wrapper for minioService.
     */
    async deleteBucket(bucketName: string, user: { id: string, email: string, ip?: string }) {
        return await minioService.deleteBucket(bucketName, user);
    }
}

export const minioBucketService = new MinioBucketService();
