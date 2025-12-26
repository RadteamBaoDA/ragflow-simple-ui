
import { minioService } from '@/services/minio.service.js';
import { ModelFactory } from '@/models/factory.js';
import { documentPermissionService, PermissionLevel } from '@/services/document-permission.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { log } from '@/services/logger.service.js';

export class MinioStorageService {
    /**
     * Resolve bucket name from ID.
     * @param bucketId - The ID of the bucket.
     * @returns Promise<string | null> - The bucket name or null if not found.
     * @description Queries the database to get the actual MinIO bucket name given a UUID.
     */
    private async getBucketName(bucketId: string): Promise<string | null> {
        try {
            const bucket = await ModelFactory.minioBucket.findById(bucketId);
            return bucket ? bucket.bucket_name : null;
        } catch (error) {
            log.error('Failed to resolve bucket name', { bucketId, error: String(error) });
            return null;
        }
    }

    /**
     * Verify user access to a bucket.
     * @param user - The user object.
     * @param bucketId - The ID of the bucket.
     * @param requiredLevel - The minimum permission level required.
     * @returns Promise<boolean> - True if access is granted.
     * @description Checks if the user (or admin) has sufficient permissions on the bucket.
     */
    async verifyAccess(user: any, bucketId: string, requiredLevel: PermissionLevel): Promise<boolean> {
        if (!user) return false;
        // Admins bypass storage ACLs
        if (user.role === 'admin') return true;

        // Resolve effective permission level for user (direct + team)
        const level = await documentPermissionService.resolveUserPermission(user.id, bucketId);
        return level >= requiredLevel;
    }

    /**
     * List files in a bucket with permission check.
     * @param user - The user requesting the list.
     * @param bucketId - The ID of the bucket.
     * @param prefix - Optional path prefix.
     * @returns Promise<FileObject[]> - List of files.
     * @throws Error if access denied or bucket not found.
     * @description Verifies VIEW permission before listing MinIO objects.
     */
    async listFiles(user: any, bucketId: string, prefix: string = '') {
        // Enforce access control
        const hasAccess = await this.verifyAccess(user, bucketId, PermissionLevel.VIEW);
        if (!hasAccess) throw new Error('Access Denied');

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) throw new Error('Bucket not found');

        // Delegate to MinIO service
        return await minioService.listFiles(bucketName, prefix);
    }

    /**
     * Upload files to a bucket with permission check and audit logging.
     * @param user - The user uploading the files.
     * @param bucketId - The ID of the bucket.
     * @param files - Array of files from Multer.
     * @param body - Request body containing path/structure options.
     * @param ip - IP address of the user.
     * @returns Promise<any[]> - Results of uploads.
     * @throws Error if access denied or upload fails.
     * @description Verifies UPLOAD permission, handles folder structure logic, uploads to MinIO, and logs audit events.
     */
    async uploadFile(user: any, bucketId: string, files: Express.Multer.File[], body: any, ip: string) {
        // Enforce UPLOAD permission
        const hasAccess = await this.verifyAccess(user, bucketId, PermissionLevel.UPLOAD);
        if (!hasAccess) throw new Error('Access Denied');

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) throw new Error('Bucket not found');

        const filePaths = body.filePaths;
        const preserveStructure = body.preserveFolderStructure === 'true';
        const results = [];

        // Process each file
        for (const file of files) {
            let objectName = file.originalname;

            // Handle folder structure preservation logic
            if (preserveStructure && filePaths) {
                const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
                const index = files.indexOf(file);
                if (paths[index]) {
                    objectName = paths[index];
                }
            }

            // Apply prefix if provided
            const prefix = body.prefix as string;
            if (prefix) {
                const cleanPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
                const cleanName = objectName.startsWith('/') ? objectName.substring(1) : objectName;
                file.originalname = `${cleanPrefix}${cleanName}`;
            } else if (preserveStructure) {
                file.originalname = objectName;
            }

            // Perform upload
            await minioService.uploadFile(bucketName, file, user?.id);
            results.push({ name: file.originalname, status: 'uploaded' });

            // Audit log
            await auditService.log({
                userId: user?.id,
                userEmail: user?.email || 'unknown',
                action: AuditAction.UPLOAD_FILE,
                resourceType: AuditResourceType.FILE,
                resourceId: file.originalname,
                details: {
                    bucketId,
                    bucketName,
                    fileName: file.originalname,
                    size: file.size,
                    mimeType: file.mimetype
                },
                ipAddress: ip
            });
        }
        return results;
    }

    /**
     * Create a folder in a bucket.
     * @param user - The user making the request.
     * @param bucketId - The ID of the bucket.
     * @param folderName - Name of formatting folder.
     * @param prefix - Parent path prefix.
     * @param ip - IP address of the user.
     * @returns Promise<void>
     * @throws Error if access denied.
     * @description Verifies UPLOAD permission and creates a folder placeholder in MinIO.
     */
    async createFolder(user: any, bucketId: string, folderName: string, prefix: string, ip: string) {
        // Enforce UPLOAD permission
        const hasAccess = await this.verifyAccess(user, bucketId, PermissionLevel.UPLOAD);
        if (!hasAccess) throw new Error('Access Denied');

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) throw new Error('Bucket not found');

        const fullPath = prefix ? `${prefix}${folderName}` : folderName;
        // Create folder in MinIO
        await minioService.createFolder(bucketName, fullPath);

        // Audit log
        await auditService.log({
            userId: user?.id,
            userEmail: user?.email || 'unknown',
            action: AuditAction.CREATE_FOLDER,
            resourceType: AuditResourceType.FILE,
            resourceId: fullPath,
            details: { bucketId, bucketName, folderName: fullPath },
            ipAddress: ip
        });
    }

    /**
     * Delete a file or folder from a bucket.
     * @param user - The user making the request.
     * @param bucketId - The ID of the bucket.
     * @param path - Path to file or folder being deleted.
     * @param isFolder - Boolean indicating if target is a folder.
     * @param ip - IP address of the user.
     * @returns Promise<void>
     * @throws Error if access denied.
     * @description Verifies FULL permission (delete requires higher privilege) and removes object(s).
     */
    async deleteObject(user: any, bucketId: string, path: string, isFolder: boolean, ip: string) {
        // Enforce FULL permission for deletion
        const hasAccess = await this.verifyAccess(user, bucketId, PermissionLevel.FULL);
        if (!hasAccess) throw new Error('Access Denied');

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) throw new Error('Bucket not found');

        // Execute deletion
        if (isFolder) {
            await minioService.deleteFolder(bucketName, path);
        } else {
            await minioService.deleteFile(bucketName, path, user?.id);
        }

        // Audit log
        await auditService.log({
            userId: user?.id,
            userEmail: user?.email || 'unknown',
            action: isFolder ? AuditAction.DELETE_FOLDER : AuditAction.DELETE_FILE,
            resourceType: AuditResourceType.FILE,
            resourceId: path,
            details: { bucketId, bucketName, path, isFolder },
            ipAddress: ip
        });
    }

    /**
     * Batch delete multiple files/folders.
     * @param user - The user making the request.
     * @param bucketId - The ID of the bucket.
     * @param items - Array of {path, isFolder} items to delete.
     * @param ip - IP address of the user.
     * @returns Promise<void>
     * @throws Error if access denied.
     * @description Verifies FULL permission and efficiently deletes multiple objects.
     */
    async batchDelete(user: any, bucketId: string, items: any[], ip: string) {
        // Enforce FULL permission
        const hasAccess = await this.verifyAccess(user, bucketId, PermissionLevel.FULL);
        if (!hasAccess) throw new Error('Access Denied');

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) throw new Error('Bucket not found');

        const files = items.filter(i => !i.isFolder).map(i => i.path);
        const folders = items.filter(i => i.isFolder).map(i => i.path);

        // Batch delete files
        if (files.length > 0) {
            await minioService.deleteObjects(bucketName, files);
        }

        // Delete folders individually (recursive operation)
        for (const folder of folders) {
            await minioService.deleteFolder(bucketName, folder);
        }

        // Audit log summary
        await auditService.log({
            userId: user?.id,
            userEmail: user?.email || 'unknown',
            action: AuditAction.BATCH_DELETE,
            resourceType: AuditResourceType.FILE,
            resourceId: `batch-${items.length}`,
            details: { bucketId, bucketName, count: items.length, items },
            ipAddress: ip
        });
    }

    /**
     * Get a presigned download URL for a file.
     * @param user - The user making the request.
     * @param bucketId - The ID of the bucket.
     * @param objectPath - Path to the object.
     * @param preview - If true, sets disposition to 'inline', else 'attachment'.
     * @param ip - IP address of the user.
     * @returns Promise<string> - The presigned URL.
     * @throws Error if access denied.
     * @description Verifies VIEW permission and generates time-limited URL.
     */
    async getDownloadUrl(user: any, bucketId: string, objectPath: string, preview: boolean, ip: string) {
        // Enforce VIEW permission
        const hasAccess = await this.verifyAccess(user, bucketId, PermissionLevel.VIEW);
        if (!hasAccess) throw new Error('Access Denied');

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) throw new Error('Bucket not found');

        const disposition = preview ? 'inline' : 'attachment';
        const url = await minioService.getDownloadUrl(bucketName, objectPath, 3600, disposition);

        // Only audit log downloads, not previews to reduce noise
        if (!preview) {
            await auditService.log({
                userId: user?.id,
                userEmail: user?.email || 'unknown',
                action: AuditAction.DOWNLOAD_FILE,
                resourceType: AuditResourceType.FILE,
                resourceId: objectPath,
                details: { bucketId, bucketName, objectPath },
                ipAddress: ip
            });
        }
        return url;
    }
}

export const minioStorageService = new MinioStorageService();
