import { minioService } from '@/services/minio.service.js';
import { ModelFactory } from '@/models/factory.js';
import { documentPermissionService, PermissionLevel } from '@/services/document-permission.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { log } from '@/services/logger.service.js';

export class MinioStorageService {
    /**
     * Resolve bucket name from ID.
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
     */
    async verifyAccess(user: any, bucketId: string, requiredLevel: PermissionLevel): Promise<boolean> {
        if (!user) return false;
        if (user.role === 'admin') return true;

        const level = await documentPermissionService.resolveUserPermission(user.id, bucketId);
        return level >= requiredLevel;
    }

    async listFiles(user: any, bucketId: string, prefix: string = '') {
        const hasAccess = await this.verifyAccess(user, bucketId, PermissionLevel.VIEW);
        if (!hasAccess) throw new Error('Access Denied');

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) throw new Error('Bucket not found');

        return await minioService.listFiles(bucketName, prefix);
    }

    async uploadFile(user: any, bucketId: string, files: Express.Multer.File[], body: any, ip: string) {
        const hasAccess = await this.verifyAccess(user, bucketId, PermissionLevel.UPLOAD);
        if (!hasAccess) throw new Error('Access Denied');

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) throw new Error('Bucket not found');

        const filePaths = body.filePaths;
        const preserveStructure = body.preserveFolderStructure === 'true';
        const results = [];

        for (const file of files) {
            let objectName = file.originalname;

            if (preserveStructure && filePaths) {
                const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
                const index = files.indexOf(file);
                if (paths[index]) {
                    objectName = paths[index];
                }
            }

            const prefix = body.prefix as string;
            if (prefix) {
                const cleanPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
                const cleanName = objectName.startsWith('/') ? objectName.substring(1) : objectName;
                file.originalname = `${cleanPrefix}${cleanName}`;
            } else if (preserveStructure) {
                file.originalname = objectName;
            }

            await minioService.uploadFile(bucketName, file, user?.id);
            results.push({ name: file.originalname, status: 'uploaded' });

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

    async createFolder(user: any, bucketId: string, folderName: string, prefix: string, ip: string) {
        const hasAccess = await this.verifyAccess(user, bucketId, PermissionLevel.UPLOAD);
        if (!hasAccess) throw new Error('Access Denied');

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) throw new Error('Bucket not found');

        const fullPath = prefix ? `${prefix}${folderName}` : folderName;
        await minioService.createFolder(bucketName, fullPath);

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

    async deleteObject(user: any, bucketId: string, path: string, isFolder: boolean, ip: string) {
        const hasAccess = await this.verifyAccess(user, bucketId, PermissionLevel.FULL);
        if (!hasAccess) throw new Error('Access Denied');

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) throw new Error('Bucket not found');

        if (isFolder) {
            await minioService.deleteFolder(bucketName, path);
        } else {
            await minioService.deleteFile(bucketName, path, user?.id);
        }

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

    async batchDelete(user: any, bucketId: string, items: any[], ip: string) {
        const hasAccess = await this.verifyAccess(user, bucketId, PermissionLevel.FULL);
        if (!hasAccess) throw new Error('Access Denied');

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) throw new Error('Bucket not found');

        const files = items.filter(i => !i.isFolder).map(i => i.path);
        const folders = items.filter(i => i.isFolder).map(i => i.path);

        if (files.length > 0) {
            await minioService.deleteObjects(bucketName, files);
        }

        for (const folder of folders) {
            await minioService.deleteFolder(bucketName, folder);
        }

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

    async getDownloadUrl(user: any, bucketId: string, objectPath: string, preview: boolean, ip: string) {
        const hasAccess = await this.verifyAccess(user, bucketId, PermissionLevel.VIEW);
        if (!hasAccess) throw new Error('Access Denied');

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) throw new Error('Bucket not found');

        const disposition = preview ? 'inline' : 'attachment';
        const url = await minioService.getDownloadUrl(bucketName, objectPath, 3600, disposition);

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
