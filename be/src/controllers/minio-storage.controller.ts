/**
 * Managed MinIO storage controller: enforces bucket-level permissions for list/upload/delete/download operations.
 * Uses documentPermissionService to guard every action; audit events are emitted for mutating operations.
 */
import { Request, Response } from 'express'
import { minioService } from '@/services/minio.service.js'
import { log } from '@/services/logger.service.js'
import { ModelFactory } from '@/models/factory.js'
import { documentPermissionService, PermissionLevel } from '@/services/document-permission.service.js'
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js'
import { getClientIp } from '@/utils/ip.js'

export class MinioStorageController {

    private async getBucketName(bucketId: string): Promise<string | null> {
        try {
            const bucket = await ModelFactory.minioBucket.findById(bucketId);
            return bucket ? bucket.bucket_name : null;
        } catch (error) {
            log.error('Failed to resolve bucket name', { bucketId, error: String(error) });
            return null;
        }
    }

    private async checkBucketAccess(req: Request, bucketId: string, requiredLevel: PermissionLevel): Promise<boolean> {
        const user = req.user;
        if (!user) return false;

        if (user.role === 'admin') return true;

        const level = await documentPermissionService.resolveUserPermission(user.id, bucketId);
        return level >= requiredLevel;
    }

    async listFiles(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        const prefix = req.query.prefix as string || '';

        if (!bucketId) {
            res.status(400).json({ error: 'Bucket ID is required' });
            return;
        }

        if (!(await this.checkBucketAccess(req, bucketId, PermissionLevel.VIEW))) {
            res.status(403).json({ error: 'Access Denied' });
            return;
        }

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) {
            res.status(404).json({ error: 'Bucket not found' });
            return;
        }

        try {
            const files = await minioService.listFiles(bucketName, prefix);
            res.json({ objects: files });
        } catch (error) {
            log.error('Failed to list files', { error: String(error) });
            res.status(500).json({ error: 'Failed to list files' });
        }
    }

    async uploadFile(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        if (!bucketId) {
            res.status(400).json({ error: 'Bucket ID is required' });
            return;
        }

        if (!(await this.checkBucketAccess(req, bucketId, PermissionLevel.UPLOAD))) {
            res.status(403).json({ error: 'Access Denied' });
            return;
        }

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) {
            res.status(404).json({ error: 'Bucket not found' });
            return;
        }

        let files = req.files as Express.Multer.File[];
        if (!files && req.file) {
            files = [req.file];
        }

        if (!files || files.length === 0) {
            res.status(400).json({ error: 'No files uploaded' });
            return;
        }

        const filePaths = req.body.filePaths;
        const preserveStructure = req.body.preserveFolderStructure === 'true';

        try {
            const results = [];
            for (const file of files) {
                let objectName = file.originalname;

                if (preserveStructure && filePaths) {
                    // Try to find matching path if array, or use single path
                    // Note: This logic assumes filePaths array index matches files array index
                    // If filePaths is not an array but a single string, unexpected behavior if multiple files?
                    // Assuming frontend sends parallel arrays.
                    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
                    // Find index of current file in files array if we need to map by index
                    const index = files.indexOf(file);
                    if (paths[index]) {
                        objectName = paths[index];
                    }
                }

                const prefix = req.query.prefix as string;
                if (prefix) {
                    const cleanPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
                    const cleanName = objectName.startsWith('/') ? objectName.substring(1) : objectName;
                    file.originalname = `${cleanPrefix}${cleanName}`;
                } else if (preserveStructure) {
                    file.originalname = objectName;
                }

                await minioService.uploadFile(bucketName, file, req.user?.id);
                results.push({ name: file.originalname, status: 'uploaded' });

                await auditService.log({
                    userId: req.user?.id,
                    userEmail: req.user?.email || 'unknown',
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
                    ipAddress: getClientIp(req)
                });
            }

            res.status(201).json(results);
        } catch (error) {
            log.error('Failed to upload file', { error: String(error) });
            res.status(500).json({ error: 'Failed to upload file' });
        }
    }

    async createFolder(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        const { folderName, prefix } = req.body;

        if (!bucketId || !folderName) {
            res.status(400).json({ error: 'Bucket ID and folder name are required' });
            return;
        }

        if (!(await this.checkBucketAccess(req, bucketId, PermissionLevel.UPLOAD))) {
            res.status(403).json({ error: 'Access Denied' });
            return;
        }

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) {
            res.status(404).json({ error: 'Bucket not found' });
            return;
        }

        try {
            const fullPath = prefix ? `${prefix}${folderName}` : folderName;
            await minioService.createFolder(bucketName, fullPath);

            await auditService.log({
                userId: req.user?.id,
                userEmail: req.user?.email || 'unknown',
                action: AuditAction.CREATE_FOLDER,
                resourceType: AuditResourceType.FILE,
                resourceId: fullPath,
                details: { bucketId, bucketName, folderName: fullPath },
                ipAddress: getClientIp(req)
            });

            res.status(201).json({ message: 'Folder created' });
        } catch (error) {
            log.error('Failed to create folder', { error: String(error) });
            res.status(500).json({ error: 'Failed to create folder' });
        }
    }

    async deleteObject(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        const { path, isFolder } = req.body;

        if (!bucketId || !path) {
            res.status(400).json({ error: 'Bucket ID and path are required' });
            return;
        }

        // Deletion requires FULL permission? Or UPLOAD? 
        // Frontend hides Delete unless FULL. Enforcing FULL here.
        if (!(await this.checkBucketAccess(req, bucketId, PermissionLevel.FULL))) {
            res.status(403).json({ error: 'Access Denied' });
            return;
        }

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) {
            res.status(404).json({ error: 'Bucket not found' });
            return;
        }

        try {
            if (isFolder) {
                await minioService.deleteFolder(bucketName, path);
            } else {
                await minioService.deleteFile(bucketName, path, req.user?.id);
            }

            await auditService.log({
                userId: req.user?.id,
                userEmail: req.user?.email || 'unknown',
                action: isFolder ? AuditAction.DELETE_FOLDER : AuditAction.DELETE_FILE,
                resourceType: AuditResourceType.FILE,
                resourceId: path,
                details: { bucketId, bucketName, path, isFolder },
                ipAddress: getClientIp(req)
            });

            res.status(204).send();
        } catch (error) {
            log.error('Failed to delete object', { error: String(error) });
            res.status(500).json({ error: 'Failed to delete object' });
        }
    }

    async batchDelete(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        const { items } = req.body;

        if (!bucketId || !Array.isArray(items)) {
            res.status(400).json({ error: 'Bucket ID and items array are required' });
            return;
        }

        if (!(await this.checkBucketAccess(req, bucketId, PermissionLevel.FULL))) {
            res.status(403).json({ error: 'Access Denied' });
            return;
        }

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) {
            res.status(404).json({ error: 'Bucket not found' });
            return;
        }

        try {
            const files = items.filter(i => !i.isFolder).map(i => i.path);
            const folders = items.filter(i => i.isFolder).map(i => i.path);

            if (files.length > 0) {
                await minioService.deleteObjects(bucketName, files);
            }

            for (const folder of folders) {
                await minioService.deleteFolder(bucketName, folder);
            }

            await auditService.log({
                userId: req.user?.id,
                userEmail: req.user?.email || 'unknown',
                action: AuditAction.BATCH_DELETE,
                resourceType: AuditResourceType.FILE,
                resourceId: `batch-${items.length}`,
                details: { bucketId, bucketName, count: items.length, items },
                ipAddress: getClientIp(req)
            });

            res.status(200).json({ message: 'Batch delete completed' });
        } catch (error) {
            log.error('Failed to batch delete', { error: String(error) });
            res.status(500).json({ error: 'Failed to batch delete' });
        }
    }

    async getDownloadUrl(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        const objectPath = req.params[0] || req.params.objectPath;
        const preview = req.query.preview === 'true';

        if (!bucketId || !objectPath) {
            res.status(400).json({ error: 'Bucket ID and object path are required' });
            return;
        }

        if (!(await this.checkBucketAccess(req, bucketId, PermissionLevel.VIEW))) {
            res.status(403).json({ error: 'Access Denied' });
            return;
        }

        const bucketName = await this.getBucketName(bucketId);
        if (!bucketName) {
            res.status(404).json({ error: 'Bucket not found' });
            return;
        }

        try {
            const disposition = preview ? 'inline' : 'attachment';
            const url = await minioService.getDownloadUrl(bucketName, objectPath, 3600, disposition);

            if (!preview) {
                await auditService.log({
                    userId: req.user?.id,
                    userEmail: req.user?.email || 'unknown',
                    action: AuditAction.DOWNLOAD_FILE,
                    resourceType: AuditResourceType.FILE,
                    resourceId: objectPath,
                    details: { bucketId, bucketName, objectPath },
                    ipAddress: getClientIp(req)
                });
            }

            res.json({ download_url: url });
        } catch (error) {
            log.error('Failed to get download URL', { error: String(error) });
            res.status(500).json({ error: 'Failed to get download URL' });
        }
    }

    async downloadFile(req: Request, res: Response): Promise<void> {
        res.status(404).json({ error: "Use getDownloadUrl" });
    }
}
