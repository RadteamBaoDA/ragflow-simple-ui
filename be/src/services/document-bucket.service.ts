
import { ModelFactory } from '@/models/factory.js';
import { minioService } from '@/services/minio.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { socketService } from '@/services/socket.service.js';
import { log } from '@/services/logger.service.js';

export class DocumentBucketService {
    /**
     * Get buckets visible to a specific user based on their role and permissions.
     * @param user - Object containing user id, role, and permissions.
     * @returns Promise<MinioBucket[]> - Array of accessible bucket records.
     * @description Admins/Managers see all; others see only explicitly assigned buckets.
     */
    async getAccessibleBuckets(user: { id: string, role: string, permissions?: string[] | any }) {
        // Check global permission
        // Admin or user with 'manage_storage' or 'storage:read'
        // Check global permission
        // Admin or user with 'manage_storage' or 'storage:read'
        let permissions: string[] = [];
        if (Array.isArray(user.permissions)) {
            permissions = user.permissions;
        } else if (typeof user.permissions === 'string') {
            try {
                permissions = JSON.parse(user.permissions);
            } catch (e) {
                permissions = [];
            }
        }

        const hasGlobalAccess = user.role === 'admin' || permissions.includes('manage_storage');

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
    /**
     * Get available buckets from MinIO that are not yet configured in DB.
     * @returns Promise<any[]> - List of unconfigured buckets.
     * @description Fetches all buckets from MinIO and filters out those already present in the database.
     */
    async getAvailableBuckets() {
        // 1. Get all actual buckets from MinIO
        const minioBuckets = await minioService.listBuckets();

        // 2. Get all configured buckets from DB
        const configuredBuckets = await ModelFactory.minioBucket.findAll({});
        const configuredNames = new Set(configuredBuckets.map(b => b.bucket_name));

        // 3. Filter out buckets that are already configured
        return minioBuckets
            .filter(b => b.name && !configuredNames.has(b.name))
            .map(b => ({
                name: b.name,
                creationDate: b.creationDate
            }));
    }

    /**
     * Create a new document bucket.
     * @param bucketName - Name of the bucket.
     * @param description - Description of the bucket.
     * @param user - User context for audit logging.
     * @returns Promise<any> - The created bucket record.
     * @description Wrapper for minioService with potential for extra business logic.
     */
    async createDocument(bucketName: string, description: string, user: { id: string, email: string, ip?: string }) {
        try {
            // 1. Check if configured in DB
            const existingConfig = await ModelFactory.minioBucket.findByName(bucketName);
            if (existingConfig) {
                throw new Error(`Bucket '${bucketName}' is already configured in the system.`);
            }

            // 2. Ensure exists in MinIO (call wrapper)
            await minioService.createBucket(bucketName, description, user);

            // 3. Register in DB
            const bucket = await ModelFactory.minioBucket.create({
                bucket_name: bucketName,
                display_name: bucketName,
                description,
                created_by: user?.id || 'system',
                updated_by: user?.id || 'system'
            });

            // 4. Audit Log
            if (user) {
                await auditService.log({
                    userId: user.id,
                    userEmail: user.email,
                    action: AuditAction.CREATE_DOCUMENT_BUCKET,
                    resourceType: AuditResourceType.BUCKET,
                    resourceId: bucket.id,
                    details: { bucketName },
                    ipAddress: user.ip,
                });
            }
            return bucket;
        } catch (error) {
            log.error('Failed to create bucket', { bucketName, error: String(error) });
            throw error;
        }
    }

    /**
     * Delete a document bucket.
     * @param bucketName - Name of the bucket to delete.
     * @param user - User context for audit logging.
     * @returns Promise<void>
     * @description Wrapper for minioService to delete a bucket and its metadata.
     * Recursively deletes all objects in the bucket before deleting the bucket itself.
     * Emits progress updates via WebSocket.
     */
    async deleteDocument(bucketName: string, user: { id: string, email: string, ip?: string }) {
        try {
            // 1. Check if bucket exists in DB and MinIO (handled by minioService somewhat, but good to check)
            // The minioService.deleteBucket does DB deletion too, but we need to empty it first.

            // Notify start
            socketService.emitToUser(user.id, 'bucket:delete:progress', {
                bucketName,
                status: 'analyzing',
                current: 0,
                total: 0,
                message: 'Analyzing bucket contents...'
            });

            // 2. List all objects recursively
            const objects = await minioService.listObjects(bucketName, '', true);
            const totalObjects = objects.length;

            socketService.emitToUser(user.id, 'bucket:delete:progress', {
                bucketName,
                status: 'deleting_objects',
                current: 0,
                total: totalObjects,
                message: `Found ${totalObjects} objects. Starting deletion...`
            });

            // 3. Delete in batches of 100
            const BATCH_SIZE = 100;
            let deletedCount = 0;

            for (let i = 0; i < totalObjects; i += BATCH_SIZE) {
                const batch = objects.slice(i, i + BATCH_SIZE);
                const objectNames = batch.map(o => o.name);

                if (objectNames.length > 0) {
                    await minioService.deleteObjects(bucketName, objectNames);
                    deletedCount += objectNames.length;

                    // Emit progress
                    socketService.emitToUser(user.id, 'bucket:delete:progress', {
                        bucketName,
                        status: 'deleting_objects',
                        current: deletedCount,
                        total: totalObjects,
                        message: `Deleted ${deletedCount} of ${totalObjects} objects...`
                    });
                }
            }

            // 4. Delete the bucket itself (and DB record)
            socketService.emitToUser(user.id, 'bucket:delete:progress', {
                bucketName,
                status: 'deleting_bucket',
                current: totalObjects,
                total: totalObjects,
                message: 'Deleting bucket...'
            });

            await minioService.deleteBucket(bucketName, user);

            // 5. Notify completion
            socketService.emitToUser(user.id, 'bucket:delete:progress', {
                bucketName,
                status: 'completed',
                current: totalObjects,
                total: totalObjects,
                message: 'Bucket deleted successfully.'
            });

        } catch (error) {
            log.error('Failed to recursively delete bucket', { bucketName, error: String(error) });
            // Notify error
            socketService.emitToUser(user.id, 'bucket:delete:progress', {
                bucketName,
                status: 'error',
                error: String(error),
                message: 'Failed to delete bucket.'
            });
            throw error;
        }
    }
}

export const documentBucketService = new DocumentBucketService();
