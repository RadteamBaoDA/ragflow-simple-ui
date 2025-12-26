/**
 * Managed MinIO storage controller: enforces bucket-level permissions for list/upload/delete/download operations.
 * Uses documentPermissionService to guard every action; audit events are emitted for mutating operations.
 */
import { Request, Response } from 'express'
import { log } from '@/services/logger.service.js'
import { getClientIp } from '@/utils/ip.js'
import { minioStorageService } from '@/services/minio-storage.service.js'

export class MinioStorageController {

    async listFiles(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        const prefix = req.query.prefix as string || '';

        if (!bucketId) {
            res.status(400).json({ error: 'Bucket ID is required' });
            return;
        }

        try {
            const files = await minioStorageService.listFiles(req.user, bucketId, prefix);
            res.json({ objects: files });
        } catch (error: any) {
            const message = String(error.message || error);
            if (message.includes('Access Denied')) {
                res.status(403).json({ error: 'Access Denied' });
                return;
            }
            if (message.includes('Bucket not found')) {
                res.status(404).json({ error: 'Bucket not found' });
                return;
            }
            log.error('Failed to list files', { error: message });
            res.status(500).json({ error: 'Failed to list files' });
        }
    }

    async uploadFile(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        if (!bucketId) {
            res.status(400).json({ error: 'Bucket ID is required' });
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

        try {
            const results = await minioStorageService.uploadFile(req.user, bucketId, files, req.body, getClientIp(req));
            res.status(201).json(results);
        } catch (error: any) {
            const message = String(error.message || error);
            if (message.includes('Access Denied')) {
                res.status(403).json({ error: 'Access Denied' });
                return;
            }
            if (message.includes('Bucket not found')) {
                res.status(404).json({ error: 'Bucket not found' });
                return;
            }
            log.error('Failed to upload file', { error: message });
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

        try {
            await minioStorageService.createFolder(req.user, bucketId, folderName, prefix, getClientIp(req));
            res.status(201).json({ message: 'Folder created' });
        } catch (error: any) {
            const message = String(error.message || error);
            if (message.includes('Access Denied')) {
                res.status(403).json({ error: 'Access Denied' });
                return;
            }
            if (message.includes('Bucket not found')) {
                res.status(404).json({ error: 'Bucket not found' });
                return;
            }
            log.error('Failed to create folder', { error: message });
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

        try {
            await minioStorageService.deleteObject(req.user, bucketId, path, isFolder, getClientIp(req));
            res.status(204).send();
        } catch (error: any) {
            const message = String(error.message || error);
            if (message.includes('Access Denied')) {
                res.status(403).json({ error: 'Access Denied' });
                return;
            }
            if (message.includes('Bucket not found')) {
                res.status(404).json({ error: 'Bucket not found' });
                return;
            }
            log.error('Failed to delete object', { error: message });
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

        try {
            await minioStorageService.batchDelete(req.user, bucketId, items, getClientIp(req));
            res.status(200).json({ message: 'Batch delete completed' });
        } catch (error: any) {
            const message = String(error.message || error);
            if (message.includes('Access Denied')) {
                res.status(403).json({ error: 'Access Denied' });
                return;
            }
            if (message.includes('Bucket not found')) {
                res.status(404).json({ error: 'Bucket not found' });
                return;
            }
            log.error('Failed to batch delete', { error: message });
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

        try {
            const url = await minioStorageService.getDownloadUrl(req.user, bucketId, objectPath, preview, getClientIp(req));
            res.json({ download_url: url });
        } catch (error: any) {
            const message = String(error.message || error);
            if (message.includes('Access Denied')) {
                res.status(403).json({ error: 'Access Denied' });
                return;
            }
            if (message.includes('Bucket not found')) {
                res.status(404).json({ error: 'Bucket not found' });
                return;
            }
            log.error('Failed to get download URL', { error: message });
            res.status(500).json({ error: 'Failed to get download URL' });
        }
    }

    async downloadFile(req: Request, res: Response): Promise<void> {
        res.status(404).json({ error: "Use getDownloadUrl" });
    }
}
