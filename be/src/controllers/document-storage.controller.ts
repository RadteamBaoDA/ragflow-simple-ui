/**
 * Managed MinIO storage controller: enforces bucket-level permissions for list/upload/delete/download operations.
 * Uses documentPermissionService to guard every action; audit events are emitted for mutating operations.
 */
import { Request, Response } from 'express'
import { log } from '@/services/logger.service.js'
import { getClientIp } from '@/utils/ip.js'
import { documentStorageService } from '@/services/document-storage.service.js';

export class DocumentStorageController {

    /**
     * List files in a bucket.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async listFiles(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        const prefix = req.query.prefix as string || '';

        // Validate bucket ID
        if (!bucketId) {
            res.status(400).json({ error: 'Bucket ID is required' });
            return;
        }

        try {
            // List files via service (enforces permissions)
            const objects = await documentStorageService.listFiles(req.user, bucketId, prefix as string);
            res.json({ objects: objects });
        } catch (error: any) {
            // Error handling with specific status codes
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

    /**
     * Upload files to a bucket.
     * @param req - Express request object containing files.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async uploadFile(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        if (!bucketId) {
            res.status(400).json({ error: 'Bucket ID is required' });
            return;
        }

        // Handle array or single file upload
        let files = req.files as Express.Multer.File[];
        if (!files && req.file) {
            files = [req.file];
        }

        // Validate file presence
        if (!files || files.length === 0) {
            res.status(400).json({ error: 'No files uploaded' });
            return;
        }

        try {
            // Upload via service
            const options = { ...req.body, prefix: req.query.prefix || req.body.prefix };
            const results = await documentStorageService.uploadFile(req.user, bucketId, req.files as Express.Multer.File[], options, getClientIp(req) || 'unknown');
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

    /**
     * Create a virtual folder in a bucket.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async createFolder(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        const { folderName, prefix } = req.body;

        if (!bucketId || !folderName) {
            res.status(400).json({ error: 'Bucket ID and folder name are required' });
            return;
        }

        try {
            // Create folder via service
            await documentStorageService.createFolder(req.user, bucketId, folderName, prefix, getClientIp(req) || 'unknown');
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

    /**
     * Delete an object (file or folder).
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async deleteObject(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        const { path, isFolder } = req.body;

        if (!bucketId || !path) {
            res.status(400).json({ error: 'Bucket ID and path are required' });
            return;
        }

        try {
            // Delete object via service
            await documentStorageService.deleteObject(req.user, bucketId, path, isFolder, getClientIp(req) || 'unknown');
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

    /**
     * Bulk delete objects (batch).
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async batchDelete(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        const { items } = req.body;

        if (!bucketId || !Array.isArray(items)) {
            res.status(400).json({ error: 'Bucket ID and items array are required' });
            return;
        }

        try {
            // Batch delete via service
            await documentStorageService.batchDelete(req.user, bucketId, items, getClientIp(req) || 'unknown');
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

    /**
     * Get a presigned download URL for a file.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async getDownloadUrl(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        const objectPath = req.params[0] || req.params.objectPath;
        const preview = req.query.preview === 'true';

        if (!bucketId || !objectPath) {
            res.status(400).json({ error: 'Bucket ID and object path are required' });
            return;
        }

        try {
            // Generate presigned URL via service
            const url = await documentStorageService.getDownloadUrl(req.user, bucketId, objectPath as string, preview, getClientIp(req) || 'unknown');
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

    /**
     * Deprecated: direct download (use getDownloadUrl instead).
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async downloadFile(req: Request, res: Response): Promise<void> {
        res.status(404).json({ error: "Use getDownloadUrl" });
    }

    /**
     * Check if files exist in the bucket.
     * @param req - Express request object.
     * @param res - Express response object.
     * @returns Promise<void>
     */
    async checkFilesExistence(req: Request, res: Response): Promise<void> {
        const { bucketId } = req.params;
        const { files } = req.body;

        if (!bucketId || !Array.isArray(files)) {
            res.status(400).json({ error: 'Bucket ID and files array are required' });
            return;
        }

        try {
            const result = await documentStorageService.checkFilesExistence(req.user, bucketId, files);
            res.json(result);
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
            log.error('Failed to check file existence', { error: message });
            res.status(500).json({ error: 'Failed to check file existence' });
        }
    }
}
